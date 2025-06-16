import http from 'http';
import https from 'https';
import FormData from 'form-data';
import fs from 'fs';

/**
 * Современный клиент API для SMSC.RU
 * @class SMSCApi
 */
class SMSCApi {
  /**
   * Создает экземпляр клиента API SMSC.RU
   * @param {Object} config - Конфигурация API
   * @param {string} [config.login] - Логин в системе SMSC.RU
   * @param {string} config.password - Пароль или API ключ
   * @param {boolean} [config.ssl=true] - Использовать ли SSL соединение
   * @param {string} [config.charset='utf-8'] - Кодировка для запросов
   * @param {number} [config.defaultFormat=3] - Формат ответа по умолчанию (3 = JSON)
   * @param {string} [config.host='smsc.ru'] - Хост API
   * @param {string} [config.sender] - Отправитель SMS сообщений
   */
  constructor(config = {}) {
    this.login = config.login || '';
    this.password = config.password || '';
    this.ssl = config.ssl !== undefined ? config.ssl : true;
    this.charset = config.charset || 'utf-8';
    this.defaultFormat = config.defaultFormat || 3; // JSON
    this.host = config.host || 'smsc.ru';
    this.sender = config.sender || '';
    this.maxRetries = config.maxRetries || 5;
  }

  /**
   * Получает URL для запроса к API
   * @private
   * @param {string} [subdomain=''] - Поддомен для запроса
   * @returns {string} URL для запроса
   */
  getBaseUrl(subdomain = '') {
    return `${this.ssl ? 'https' : 'http'}://${subdomain}${this.host}/sys/`;
  }

  /**
   * Конвертирует данные запроса в формат API
   * @private
   * @param {Object} data - Данные для отправки
   * @param {Array} [excludeFromConversion=[]] - Поля, которые не нужно конвертировать
   * @returns {Object} Преобразованные данные
   */
  convertData(data, excludeFromConversion = []) {
    const result = { ...data };
    
    // Удаляем или преобразуем поля
    if (result.fmt) delete result.fmt;
    
    // Обработка текста сообщения
    if (result.msg) {
      result.mes = result.msg;
      delete result.msg;
    }
    if (result.message) {
      result.mes = result.message;
      delete result.message;
    }
    
    // Обработка телефонных номеров
    if (result.phone && !excludeFromConversion.includes('phone')) {
      result.phones = result.phone;
      delete result.phone;
    }
    if (result.number) {
      result.phones = result.number;
      delete result.number;
    }
    
    // Обработка массива телефонов
    if (result.phones && typeof result.phones !== 'string' && typeof result.phones !== 'number') {
      result.phones = result.phones.join(',');
    }
    
    // Обработка списка
    if (result.list) {
      let listStr = '';
      for (const [key, value] of Object.entries(result.list)) {
        listStr += `${key}:${value}\n`;
      }
      result.list = listStr;
      delete result.mes;
    }
    
    return result;
  }

  /**
   * Добавляет файлы в форму
   * @private
   * @param {FormData} form - Объект FormData
   * @param {Object} data - Данные запроса
   */
  addFilesToForm(form, data) {
    if (!data.files) return;
    
    if (typeof data.files === 'string') {
      const filePath = data.files;
      const fileContent = fs.readFileSync(filePath);
      form.append('file', fileContent, {
        filename: filePath.split('/').pop()
      });
      return;
    }
    
    if (Array.isArray(data.files)) {
      data.files.forEach((filePath, index) => {
        const fileContent = fs.readFileSync(filePath);
        form.append(`file${index}`, fileContent, {
          filename: filePath.split('/').pop()
        });
      });
      return;
    }
    
    Object.entries(data.files).forEach(([key, filePath]) => {
      const fileContent = fs.readFileSync(filePath);
      form.append(key, fileContent, {
        filename: filePath.split('/').pop()
      });
    });
  }

  /**
   * Выполняет запрос к API
   * @private
   * @param {Object} options - Параметры запроса
   * @param {string} options.endpoint - Конечная точка API
   * @param {Object} [options.data={}] - Данные для отправки
   * @param {string} [options.type] - Тип сообщения
   * @param {Array} [options.excludeFromConversion=[]] - Поля, которые не нужно конвертировать
   * @returns {Promise<Object>} Результат запроса
   */
  async request(options) {
    const { endpoint, data = {}, type, excludeFromConversion = [] } = options;
    const format = data.fmt || this.defaultFormat;
    
    // Создание FormData
    const form = new FormData();
    form.append('fmt', format);
    
    // Добавление учетных данных
    if (this.login) {
      form.append('login', this.login);
      form.append('psw', this.password);
    } else {
      form.append('apikey', this.password);
    }
    
    // Добавление других параметров
    form.append('charset', this.charset);
    if (type) form.append(type, 1);
    if (this.sender) form.append('sender', this.sender);
    
    // Преобразование и добавление данных
    const convertedData = this.convertData(data, excludeFromConversion);
    if (convertedData.files) {
      this.addFilesToForm(form, convertedData);
      delete convertedData.files;
    }
    
    // Добавление всех оставшихся данных в форму
    Object.entries(convertedData).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    // Выполнение запроса с повторными попытками
    let retryCount = 0;
    let subdomain = '';
    
    while (retryCount <= this.maxRetries) {
      try {
        const url = this.getBaseUrl(subdomain) + endpoint;
        const response = await this.sendFormData(form, url);
        return response;
      } catch (error) {
        retryCount++;
        if (retryCount <= this.maxRetries) {
          subdomain = `www${retryCount > 1 ? retryCount : ''}.`;
        } else {
          throw new Error(`Connection error after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Отправляет данные формы через HTTP/HTTPS
   * @private
   * @param {FormData} form - Форма с данными
   * @param {string} url - URL для запроса
   * @returns {Promise<Object>} Ответ API
   */
  sendFormData(form, url) {
    return new Promise((resolve, reject) => {
      const requestOptions = new URL(url);
      
      const httpModule = this.ssl ? https : http;
      
      form.submit({
        protocol: requestOptions.protocol,
        host: requestOptions.host,
        path: requestOptions.pathname,
      }, (err, res) => {
        if (err) {
          return reject(err);
        }
        
        res.setEncoding(this.charset);
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
        
        res.on('error', (error) => {
          reject(error);
        });
      });
    });
  }

  /**
   * Отправляет сообщение любого типа
   * @param {string} type - Тип сообщения (sms, viber, voice и т.д.)
   * @param {Object} data - Параметры отправки
   * @returns {Promise<Object>} Результат отправки
   */
  async send(type, data = {}) {
    return this.request({
      endpoint: 'send.php',
      data,
      type
    });
  }

  /**
   * Отправляет простое SMS сообщение
   * @param {Object} data - Параметры отправки
   * @param {string|Array} data.phones - Номер телефона или массив номеров
   * @param {string} data.mes - Текст сообщения
   * @param {Object} [data.options] - Дополнительные параметры
   * @returns {Promise<Object>} Результат отправки
   */
  async sendSms(data = {}) {
    return this.request({
      endpoint: 'send.php',
      data
    });
  }

  /**
   * Получает статус отправленного сообщения
   * @param {Object} data - Параметры запроса
   * @param {string|Array} data.phone - Номер телефона или массив номеров
   * @param {string|Array} data.id - ID сообщения или массив ID
   * @returns {Promise<Object>} Статус сообщения
   */
  async getStatus(data = {}) {
    const excludeFields = ['phone'];
    return this.request({
      endpoint: 'status.php',
      data,
      excludeFromConversion: excludeFields
    });
  }

  /**
   * Получает баланс аккаунта
   * @returns {Promise<number>} Текущий баланс
   */
  async getBalance() {
    try {
      const response = await this.request({
        endpoint: 'balance.php',
        data: { cur: 1 }
      });
      return response.balance;
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  /**
   * Получает стоимость отправки сообщения
   * @param {Object} data - Параметры сообщения
   * @returns {Promise<number>} Стоимость отправки
   */
  async getSmsCost(data = {}) {
    try {
      const requestData = { ...data, cost: 1 };
      const response = await this.request({
        endpoint: 'send.php',
        data: requestData
      });
      return response.cost;
    } catch (error) {
      console.error('Error getting SMS cost:', error);
      return 0;
    }
  }
  
  /**
   * Выполняет произвольный запрос к API
   * @param {string} endpoint - Конечная точка API
   * @param {Object} data - Данные запроса
   * @returns {Promise<Object>} Результат запроса
   */
  async raw(endpoint, data = {}) {
    return this.request({
      endpoint,
      data
    });
  }

  /**
   * Тестирует соединение и авторизацию
   * @returns {Promise<boolean>} Результат теста (true - успешно)
   */
  async test() {
    try {
      await this.getBalance();
      return true;
    } catch (error) {
      return false;
    }
  }
}


export default SMSCApi;
