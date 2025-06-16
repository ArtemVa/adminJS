import SMSCApi from './smsc_api.js';
import cfg from '../config/srv.cfg.js';

// Инициализация клиента SMSC API с настройками из конфигурации
const smsClient = new SMSCApi({
  login: process.env.SMS_API_LOGIN || cfg.sms_api_login || '',
  password: process.env.SMS_API_PASSWORD || cfg.sms_api_password || '',
  sender: process.env.SMS_SENDER || cfg.sms_sender || 'MP LAB',
  ssl: true
});

/**
 * Форматирование номера телефона к стандартному виду
 * @param {String} phone - Номер телефона в любом формате
 * @returns {String} Отформатированный номер телефона (+7XXXXXXXXXX)
 */
export const formatPhone = (phone) => {
  let formattedPhone = phone.replace(/[() \-]/g, '');
  if (formattedPhone.startsWith('8')) {
    formattedPhone = '+7' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }
  return formattedPhone;
};

/**
 * Отправка SMS через SMSC.RU API
 * @param {Object} options - Параметры отправки SMS
 * @param {String|Array} options.to - Номер телефона или массив номеров
 * @param {String} options.text - Текст сообщения
 * @param {String} [options.from] - Имя отправителя (если не указано, используется значение по умолчанию)
 * @param {Boolean} [options.translit] - Нужно ли транслитерировать сообщение (по умолчанию false)
 * @param {Number} [options.time] - Время отправки в UNIX-формате (по умолчанию - сейчас)
 * @param {Boolean} [options.test] - Тестовый режим без реальной отправки (по умолчанию false)
 * @returns {Promise<Object>} Результат отправки SMS
 */
export const sendSms = async (options) => {
  try {
    const { to, text, from = null, translit = false, time = null, test = false } = options;
    
    if (!to || !text) {
      throw new Error('Необходимо указать получателя и текст сообщения');
    }
    
    // Форматируем все номера телефонов
    const recipients = Array.isArray(to) 
      ? to.map(phone => formatPhone(phone)) 
      : [formatPhone(to)];
    
    // Параметры для API запроса
    const params = {
      phones: recipients,
      mes: text,
      translit: translit ? 1 : 0,
      id: Date.now()  // Уникальный ID для отслеживания сообщения
    };
    
    // Добавляем опциональные параметры
    if (from) params.sender = from;
    if (time) params.time = time;
    if (test) params.test = 1;
    
    // Отправляем запрос к SMSC API
    const result = await smsClient.sendSms(params);
    
    // Логирование и обработка результата
    if (result.error) {
      console.error(`Ошибка отправки SMS: ${result.error}`);
      return {
        success: false,
        error: result.error,
        errorCode: result.error_code,
        raw: result
      };
    }
    
    console.log(`SMS успешно отправлено на ${recipients.join(', ')}. ID: ${result.id}`);
    
    return {
      success: true,
      messageId: result.id,
      balance: result.balance,
      cost: result.cost,
      count: recipients.length,
      raw: result
    };
  } catch (error) {
    console.error('Ошибка при отправке SMS:', error);
    
    return {
      success: false,
      error: error.message || 'Неизвестная ошибка',
      raw: error
    };
  }
};

/**
 * Отправка SMS с использованием различных шаблонов
 * @param {String|Array} to - Номер телефона или массив номеров
 * @param {String} template - Идентификатор шаблона
 * @param {Object} data - Данные для шаблона
 * @param {Object} options - Дополнительные параметры отправки
 * @returns {Promise<Object>} Результат отправки SMS
 */
export const sendTemplatedSms = async (to, template, data = {}, options = {}) => {
  // Словарь доступных шаблонов
  const templates = {
    // Шаблоны для авторизации
    verification: {
      text: `Код подтверждения: {{code}}`,
      process: (data) => ({ text: templates.verification.text.replace('{{code}}', data.code) })
    },
    registration: {
      text: `Для регистрации на платформе введите код {{code}}`,
      process: (data) => ({ text: templates.registration.text.replace('{{code}}', data.code) })
    },
    passwordReset: {
      text: `Для сброса пароля введите код {{code}}`,
      process: (data) => ({ text: templates.passwordReset.text.replace('{{code}}', data.code) })
    },
        
    // Общие шаблоны
    custom: {
      process: (data) => ({ text: data.text })
    }
  };
  
  // Проверяем существование шаблона
  if (!templates[template]) {
    throw new Error(`Шаблон "${template}" не найден`);
  }
  
  // Обрабатываем данные через шаблон
  const processedTemplate = templates[template].process(data);
  
  // Отправляем SMS с обработанным текстом
  return await sendSms({
    to,
    text: processedTemplate.text,
    ...options
  });
};

/**
 * Отправка кода подтверждения по SMS
 * @param {String|Array} to - Номер телефона или массив номеров
 * @param {String} code - Код подтверждения
 * @param {String} type - Тип кода (verification, registration, passwordReset)
 * @param {Object} options - Дополнительные параметры отправки
 * @returns {Promise<Object>} Результат отправки SMS
 */
export const sendVerificationCode = async (to, code, type = 'verification', options = {}) => {
  // Проверяем, что тип подтверждения валидный
  const validTypes = ['verification', 'registration', 'passwordReset'];
  if (!validTypes.includes(type)) {
    type = 'verification';
  }
  
  return await sendTemplatedSms(to, type, { code }, options);
};

/**
 * Получение статуса отправленного SMS
 * @param {String} smsId - ID сообщения, полученный при отправке
 * @returns {Promise<Object>} Информация о статусе SMS
 */
export const getSmsStatus = async (smsId) => {
  try {
    const result = await smsClient.getStatus({
      id: smsId
    });
    
    if (result.error) {
      return {
        success: false,
        error: result.error,
        errorCode: result.error_code,
        raw: result
      };
    }
    
    return {
      success: true,
      status: result.status,
      statusText: getStatusText(result.status),
      deliveryTime: result.delivered,
      raw: result
    };
  } catch (error) {
    console.error('Ошибка при получении статуса SMS:', error);
    
    return {
      success: false,
      error: error.message,
      raw: error
    };
  }
};

/**
 * Получение текстового описания статуса SMS
 * @private
 * @param {Number} statusCode - Код статуса SMS
 * @returns {String} Текстовое описание статуса
 */
const getStatusText = (statusCode) => {
  const statuses = {
    0: 'Отправлено',
    1: 'Доставлено',
    2: 'Прочитано',
    3: 'Просрочено',
    20: 'Невозможно доставить',
    22: 'Неверный номер',
    23: 'Запрещено',
    24: 'Недостаточно средств',
    25: 'Недоступный номер'
  };
  
  return statuses[statusCode] || 'Неизвестный статус';
};

/**
 * Получение баланса аккаунта SMSC.RU
 * @returns {Promise<Object>} Информация о балансе
 */
export const getBalance = async () => {
  try {
    const balance = await smsClient.getBalance();
    
    return {
      success: true,
      balance,
      currency: 'RUB'
    };
  } catch (error) {
    console.error('Ошибка при получении баланса:', error);
    
    return {
      success: false,
      error: error.message,
      raw: error
    };
  }
};

/**
 * Проверка стоимости отправки SMS
 * @param {Object} options - Параметры для проверки стоимости
 * @param {String|Array} options.to - Номер телефона или массив номеров
 * @param {String} options.text - Текст сообщения
 * @returns {Promise<Object>} Информация о стоимости
 */
export const getSmsPrice = async (options) => {
  try {
    const { to, text } = options;
    
    if (!to || !text) {
      throw new Error('Необходимо указать получателя и текст сообщения');
    }
    
    // Форматируем все номера телефонов
    const recipients = Array.isArray(to) 
      ? to.map(phone => formatPhone(phone)) 
      : [formatPhone(to)];
    
    const cost = await smsClient.getSmsCost({
      phones: recipients.join(','),
      mes: text
    });
    
    return {
      success: true,
      totalCost: cost,
      perMessageCost: cost / recipients.length,
      recipientCount: recipients.length
    };
  } catch (error) {
    console.error('Ошибка при получении стоимости SMS:', error);
    
    return {
      success: false,
      error: error.message,
      raw: error
    };
  }
};

export default {
  formatPhone,
  sendSms,
  sendTemplatedSms,
  sendVerificationCode,
  getSmsStatus,
  getBalance,
  getSmsPrice
};