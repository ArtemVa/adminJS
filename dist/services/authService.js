import jwtoken from 'jsonwebtoken';
import User from '../db/user.model.js';
import Company from '../db/company.model.js';
import Tariff from '../db/tariff.model.js';
import { AuthSession, RefreshToken, AutoLoginToken} from '../db/auth.model.js';
import smsService from './smsService.js';
import cfg from '../config/srv.cfg.js';
import zxcvbn from 'zxcvbn';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ReferralLinks from '../db/referralLinks.model.js';
import { handleInternalLeadBitrix } from '../services/BitrixIntegration.js';

// Количество раундов хеширования (чем больше, тем безопаснее, но медленнее)
const SALT_ROUNDS = 10;

/**
 * Проверка надежности пароля с использованием zxcvbn
 * @param {string} password - Пароль для проверки
 * @param {Object} userData - Данные пользователя для улучшения проверки
 * @returns {Object} Результат проверки с сообщениями и оценкой
 */
const validatePasswordStrength = (password, userData = {}) => {
  // Добавляем пользовательские данные для проверки на совпадения
  // Например, не стоит использовать имя или email в пароле
  const userInputs = [];
  if (userData.login) userInputs.push(userData.login);
  if (userData.email) userInputs.push(userData.email);
  if (userData.firstName) userInputs.push(userData.firstName);
  if (userData.lastName) userInputs.push(userData.lastName);
  if (userData.phone) userInputs.push(userData.phone);
  
  // Получаем результат проверки
  const result = zxcvbn(password, userInputs);
  
  // Оценка идет от 0 (очень слабый) до 4 (очень сильный)
  const isStrong = result.score >= 3;
  
  return {
    isStrong,
    score: result.score,
    feedback: result.feedback,
    estimatedCrackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second
  };
};

/**
 * Хеширование пароля
 * @param {string} password - Пароль в открытом виде
 * @returns {Promise<string>} Хешированный пароль
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Проверка пароля
 * @param {string} password - Пароль в открытом виде
 * @param {string} hash - Хешированный пароль
 * @returns {Promise<boolean>} true если пароль верный
 */
export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Получение активной сессии по идентификатору
 * @param {String} sessionId - Идентификатор сессии
 * @returns {Object|null} Сессия или null, если сессия не найдена или истекла
 */
export const getSession = async (sessionId) => {
  return await AuthSession.getActiveSession(sessionId);
};

/**
 * Авторизация по логину и паролю
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const login = async (email, password) => {
  console.log(email, password);
  console.log({phone: email});
    const user = await User.findOne({ phone: email }).populate("company");
    if (!user) return null

    const isPasswordValid = await verifyPassword(password, user.passHash);
    if (!isPasswordValid) return null

    // Создаем токены доступа
    return {
    phone: user.phone,
    name: `${user.firstName} ${user.lastName}`,
    _id: user._id,
    admin: user.admin,
    company: {
      _id: user.company._id,
      name: user.company.name,
    }
  }
};

/**
 * Начало регистрации через SMS с получением всех данных пользователя
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const startRegistration = async (req, res) => {
  try {
    let { phone, firstName, lastName, email, password, companyName } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'missing_phone',
        message: 'Не указан номер телефона'
      });
    }
    handleInternalLeadBitrix(phone, firstName + " " + lastName, email )
    // Форматирование номера телефона
    phone = smsService.formatPhone(phone);
    
    // Проверка наличия недавней активной сессии для данного номера
    const sessionCheck = await checkActiveSessionForPhone(phone, 'registration');
    
    if (!sessionCheck.canProceed) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit',
        message: 'Слишком частые запросы на регистрацию',
        cooldown: sessionCheck.cooldown,
        nextAttemptIn: sessionCheck.message,
        sessionId: sessionCheck.existingSessionId // Возвращаем ID существующей сессии
      });
    }
    
    // Если у нас уже есть активная сессия, и прошло больше минуты, используем её
    if (sessionCheck.existingSession) {
      const session = sessionCheck.existingSession;
      
      // Обновляем код и отправляем новый SMS
      const newCode = await session.updateCode();
      await smsService.sendVerificationCode(phone, newCode, 'registration');
      
      // Не возвращаем код в ответе API
      return res.status(200).json({
        success: true,
        sessionId: session.sessionId,
        expiresIn: Math.floor((session.expiresAt - new Date()) / 1000),
        isExistingSession: true
      });
    }
    
    // Проверка пароля
    if (password) {
      const passwordCheck = validatePasswordStrength(password, { firstName, lastName, email, phone });
      
      if (!passwordCheck.isStrong) {
        return res.status(400).json({
          success: false,
          error: 'weak_password',
          message: 'Пароль недостаточно надежный',
          passwordFeedback: {
            score: passwordCheck.score,
            suggestions: passwordCheck.feedback.suggestions,
            warning: passwordCheck.feedback.warning,
            estimatedCrackTime: passwordCheck.estimatedCrackTime
          }
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'missing_password',
        message: 'Необходимо указать пароль'
      });
    }
    
    // Проверка существующего пользователя
    const existingUser = await User.findOne({ 'phone': phone });
    
    if (existingUser && existingUser.is_active) {
      return res.status(400).json({
        success: false,
        error: 'user_exists',
        message: 'Пользователь с таким номером телефона уже зарегистрирован'
      });
    }
    
    // Хешируем пароль для безопасного хранения
    const hashedPassword = await hashPassword(password);
    
    // Создаем сессию регистрации со всеми данными пользователя
    const sessionData = await AuthSession.createSession(phone, 'registration', {
      firstName,
      lastName,
      email,
      hashedPassword,
      companyName,
      existingUserId: existingUser ? existingUser._id : null
    });
    
    // Отправляем SMS с кодом
    await smsService.sendVerificationCode(phone, sessionData.code, 'registration');
    
    // Не возвращаем код в ответе API
    delete sessionData.code;
    
    return res.status(200).json({
      success: true,
      sessionId: sessionData.sessionId,
      expiresIn: sessionData.expiresIn,
      isNewUser: !existingUser
    });
  } catch (error) {
    console.error('Ошибка при начале регистрации:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Проверка кода подтверждения и завершение регистрации
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const verifyAndCompleteRegistration = async (req, res) => {
  try {
    const { code, referral } = req.body;
    const session = req.session;
    
    // Проверяем тип сессии
    if (session.type !== 'registration') {
      return res.status(400).json({
        success: false,
        error: 'invalid_session_type',
        message: 'Неверный тип сессии'
      });
    }
    
    // Проверяем превышение попыток
    if (session.attempts >= session.maxAttempts) {
      return res.status(400).json({
        success: false,
        error: 'max_attempts_exceeded',
        message: 'Превышено максимальное количество попыток'
      });
    }
    
    session.attempts += 1;
    await session.save();
    
    // Проверяем код
    if (code !== session.code) {
      return res.status(400).json({
        success: false,
        error: 'invalid_code',
        message: 'Неверный код подтверждения',
        attemptsLeft: session.maxAttempts - session.attempts
      });
    }
    
    // Код подтвержден, получаем данные пользователя из сессии
    const { firstName, lastName, email, hashedPassword, companyName, existingUserId } = session.userData;
    let referralId = null
    // Проверяем наличие реферала
    console.log(referral);
    if (referral) {
      const referralLink = await ReferralLinks.findOne({ link: referral.toString() });
      console.log(referralLink, referralLink?.user);
      if (referralLink) {
        referralId = referralLink.user;
      }
    }
    // Проверяем существование пользователя
    let user;
    if (existingUserId) {
      user = await User.findById(existingUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'user_not_found',
          message: 'Пользователь не найден'
        });
      }
    }
    
    // Создаем компанию
    const company = await Company.create({
      name: companyName || `Компания ${firstName || 'Пользователя'}`
    });
    await assignStartTariff(company._id);
    if (user) {
      // Обновляем существующего пользователя
      user.passHash = hashedPassword;
      user.is_active = true;
      user.company = company._id;
      user.phone = session.phone;
      user.firstName = firstName;
      user.lastName = lastName;
      user.email = email;
    } else {
      // Создаем нового пользователя
      const login = session.phone;
      user = new User({
        login,
        passHash: hashedPassword,
        is_active: true,
        admin: false,
        company: company._id,
        phone: session.phone,
        firstName,
        lastName,
        email,
        origin: referralId
      });
    }
    
    await user.save();
    
    // Создаем токен доступа
    const token = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: company
    }, cfg.api_token, { expiresIn: '24h' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    // Удаляем сессию
    await AuthSession.deleteOne({ sessionId: req.body.sessionId });
    
    // Возвращаем данные пользователя с токеном
    const populatedUser = await User.findById(user._id).populate('company');
    
    return res.status(201).json({
      success: true,
      token,
      refreshToken,
      expiresIn: 86400, // 24 часа в секундах
      user: {
        id: user._id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        admin: user.admin,
        phone: user.phone,
        email: user.email,
        company: populatedUser.company
      }
    });
  } catch (error) {
    console.error('Ошибка при подтверждении и завершении регистрации:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Начало авторизации по телефону
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const startPhoneLogin = async (req, res) => {
  try {
    let { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'missing_phone',
        message: 'Не указан номер телефона'
      });
    }
    
    // Форматирование номера телефона
    phone = smsService.formatPhone(phone);
    
    // Проверка наличия недавней активной сессии для данного номера
    const sessionCheck = await checkActiveSessionForPhone(phone, 'login');
    
    if (!sessionCheck.canProceed) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit',
        message: 'Слишком частые запросы на авторизацию',
        cooldown: sessionCheck.cooldown,
        nextAttemptIn: sessionCheck.message,
        sessionId: sessionCheck.existingSessionId // Возвращаем ID существующей сессии
      });
    }
    
    // Проверка существующего активного пользователя
    const user = await User.findOne({ 'phone': phone, is_active: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь с таким номером телефона не зарегистрирован или не активирован'
      });
    }
    
    // Если у нас уже есть активная сессия, и прошло больше минуты, используем её
    if (sessionCheck.existingSession) {
      const session = sessionCheck.existingSession;
      
      // Проверяем, что сессия принадлежит этому пользователю
      if (session.userData && session.userData.userId && 
          session.userData.userId.toString() === user._id.toString()) {
        
        // Обновляем код и отправляем новый SMS
        const newCode = await session.updateCode();
        await smsService.sendVerificationCode(phone, newCode, 'verification');
        
        // Не возвращаем код в ответе API
        return res.status(200).json({
          success: true,
          sessionId: session.sessionId,
          expiresIn: Math.floor((session.expiresAt - new Date()) / 1000),
          isExistingSession: true
        });
      }
    }
    
    // Создаем сессию авторизации
    const sessionData = await AuthSession.createSession(phone, 'login', {
      userId: user._id
    });
    
    // Отправляем SMS с кодом
    await smsService.sendVerificationCode(phone, sessionData.code, 'verification');
    
    // Не возвращаем код в ответе API
    delete sessionData.code;
    
    return res.status(200).json({
      success: true,
      sessionId: sessionData.sessionId,
      expiresIn: sessionData.expiresIn
    });
  } catch (error) {
    console.error('Ошибка при начале авторизации по SMS:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Проверка кода подтверждения при входе по телефону
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const verifyPhoneLogin = async (req, res) => {
  try {
    const { code } = req.body;
    const session = req.session;
    
    // Проверяем тип сессии
    if (session.type !== 'login') {
      return res.status(400).json({
        success: false,
        error: 'invalid_session_type',
        message: 'Неверный тип сессии'
      });
    }
    
    // Проверяем превышение попыток
    if (session.attempts >= session.maxAttempts) {
      return res.status(400).json({
        success: false,
        error: 'max_attempts_exceeded',
        message: 'Превышено максимальное количество попыток'
      });
    }
    
    session.attempts += 1;
    await session.save();
    
    // Проверяем код
    if (code !== session.code) {
      return res.status(400).json({
        success: false,
        error: 'invalid_code',
        message: 'Неверный код подтверждения',
        attemptsLeft: session.maxAttempts - session.attempts
      });
    }
    
    // Код подтвержден
    session.verified = true;
    await session.save();
    
    // Получаем пользователя
    const user = await User.findById(session.userData.userId).populate("company");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Создаем токены доступа
    const token = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '24h' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    // Удаляем сессию
    await AuthSession.deleteOne({ sessionId: req.body.sessionId });
    
    return res.status(200).json({
      success: true,
      token,
      refreshToken,
      expiresIn: 86400, // 24 часа в секундах
      user: {
        id: user._id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        admin: user.admin,
        phone: user.phone,
        email: user.email,
        company: user.company
      }
    });
  } catch (error) {
    console.error('Ошибка при подтверждении кода авторизации:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Запрос на сброс пароля
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const requestPasswordReset = async (req, res) => {
  try {
    let { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'missing_phone',
        message: 'Не указан номер телефона'
      });
    }
    
    // Форматирование номера телефона
    phone = smsService.formatPhone(phone);
    
    // Проверка наличия недавней активной сессии для данного номера
    const sessionCheck = await checkActiveSessionForPhone(phone, 'password_reset');
    
    if (!sessionCheck.canProceed) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit',
        message: 'Слишком частые запросы на сброс пароля',
        cooldown: sessionCheck.cooldown,
        nextAttemptIn: sessionCheck.message,
        sessionId: sessionCheck.existingSessionId // Возвращаем ID существующей сессии
      });
    }
    
    // Проверка существующего активного пользователя
    const user = await User.findOne({ 'phone': phone, is_active: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь с таким номером телефона не найден'
      });
    }
    
    // Если у нас уже есть активная сессия, и прошло больше минуты, используем её
    if (sessionCheck.existingSession) {
      const session = sessionCheck.existingSession;
      
      // Проверяем, что сессия принадлежит этому пользователю
      if (session.userData && session.userData.userId && 
          session.userData.userId.toString() === user._id.toString()) {
        
        // Обновляем код и отправляем новый SMS
        const newCode = await session.updateCode();
        await smsService.sendVerificationCode(phone, newCode, 'passwordReset');
        
        // Не возвращаем код в ответе API
        return res.status(200).json({
          success: true,
          sessionId: session.sessionId,
          expiresIn: Math.floor((session.expiresAt - new Date()) / 1000),
          isExistingSession: true
        });
      }
    }
    
    // Создаем сессию сброса пароля
    const sessionData = await AuthSession.createSession(phone, 'password_reset', {
      userId: user._id
    });
    
    // Отправляем SMS с кодом
    await smsService.sendVerificationCode(phone, sessionData.code, 'passwordReset');
    
    // Не возвращаем код в ответе API
    delete sessionData.code;
    
    return res.status(200).json({
      success: true,
      sessionId: sessionData.sessionId,
      expiresIn: sessionData.expiresIn
    });
  } catch (error) {
    console.error('Ошибка при запросе сброса пароля:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Подтверждение сброса пароля и установка нового пароля
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const verifyPasswordReset = async (req, res) => {
  try {
    const { code, newPassword } = req.body;
    const session = req.session;
    
    // Проверяем тип сессии
    if (session.type !== 'password_reset') {
      return res.status(400).json({
        success: false,
        error: 'invalid_session_type',
        message: 'Неверный тип сессии'
      });
    }
    
    // Проверяем превышение попыток
    if (session.attempts >= session.maxAttempts) {
      return res.status(400).json({
        success: false,
        error: 'max_attempts_exceeded',
        message: 'Превышено максимальное количество попыток'
      });
    }
    
    session.attempts += 1;
    await session.save();
    
    // Проверяем код
    if (code !== session.code) {
      return res.status(400).json({
        success: false,
        error: 'invalid_code',
        message: 'Неверный код подтверждения',
        attemptsLeft: session.maxAttempts - session.attempts
      });
    }
    
    // Проверяем наличие нового пароля
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'missing_password',
        message: 'Не указан новый пароль'
      });
    }
    
    // Получаем пользователя
    const user = await User.findById(session.userData.userId).populate("company");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем сложность нового пароля
    const userData = {
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone
    };
    
    const passwordCheck = validatePasswordStrength(newPassword, userData);
    
    if (!passwordCheck.isStrong) {
      return res.status(400).json({
        success: false,
        error: 'weak_password',
        message: 'Пароль недостаточно надежный',
        passwordFeedback: {
          score: passwordCheck.score,
          suggestions: passwordCheck.feedback.suggestions,
          warning: passwordCheck.feedback.warning,
          estimatedCrackTime: passwordCheck.estimatedCrackTime
        }
      });
    }
    
    // Хешируем и сохраняем новый пароль
    user.passHash = await hashPassword(newPassword);
    await user.save();
    
    // Отзываем все существующие токены для усиления безопасности
    await RefreshToken.revokeAllUserTokens(user._id);
    
    // Удаляем сессию
    await AuthSession.deleteOne({ sessionId: req.body.sessionId });
    
    // Создаем новые токены доступа
    const token = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '24h' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );

    return res.status(200).json({
      success: true,
      message: 'Пароль успешно изменен',
      token,
      refreshToken,
      expiresIn: 86400, // 24 часа в секундах
      user: {
        id: user._id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        admin: user.admin,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Ошибка при сбросе пароля:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Обновление токена доступа
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'missing_token',
        message: 'Не указан refresh token'
      });
    }
    
    // Проверяем токен
    let decodedToken;
    try {
      decodedToken = jwtoken.verify(token, cfg.refresh_token_secret || 'refresh-secret');
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'invalid_token',
        message: 'Недействительный или истекший токен'
      });
    }
    
    if (decodedToken.tokenType !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'invalid_token_type',
        message: 'Неверный тип токена'
      });
    }
    
    // Получаем пользователя и проверяем токен в базе
    const user = await User.findById(decodedToken.id).populate("company");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем существование токена в базе данных и его валидность
    const refreshTokenRecord = await RefreshToken.findActiveToken(user._id, token);
    
    if (!refreshTokenRecord) {
      return res.status(401).json({
        success: false,
        error: 'token_revoked',
        message: 'Токен был отозван или истек'
      });
    }
    
    // Отмечаем текущий токен как отозванный
    refreshTokenRecord.isRevoked = true;
    await refreshTokenRecord.save();
    
    // Создаем новые токены
    const newToken = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '24h' });
    
    const newRefreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о новом токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      newRefreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    return res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: 86400 // 24 часа в секундах
    });
  } catch (error) {
    console.error('Ошибка при обновлении токена:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Повторная отправка кода подтверждения
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const resendCode = async (req, res) => {
  try {
    const session = req.session;
    const now = Date.now();
    
    // Проверяем интервал между отправками (не чаще 1 раза в минуту)
    const cooldownSeconds = 60;
    const secondsSinceLastSend = Math.floor((now - session.lastCodeSentAt) / 1000);
    
    if (secondsSinceLastSend < cooldownSeconds) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit',
        message: 'Слишком частые запросы на отправку кода',
        cooldown: cooldownSeconds - secondsSinceLastSend
      });
    }
    
    // Генерируем новый код
    const newCode = await session.updateCode();
    
    // Отправляем SMS
    let templateType;
    if (session.type === 'registration') {
      templateType = 'registration';
    } else if (session.type === 'login') {
      templateType = 'verification';
    } else if (session.type === 'password_reset') {
      templateType = 'passwordReset';
    } else {
      templateType = 'verification';
    }
    
    await smsService.sendVerificationCode(session.phone, newCode, templateType);
    
    return res.status(200).json({
      success: true,
      expiresIn: Math.floor((session.expiresAt - now) / 1000),
      attempts: session.maxAttempts - session.attempts,
      cooldown: cooldownSeconds
    });
  } catch (error) {
    console.error('Ошибка при повторной отправке кода:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Выход из системы (Logout)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const logout = async (req, res) => {
  try {
    // Проверяем наличие токена
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(200).json({
        success: true,
        message: 'Выход успешно выполнен'
      });
    }
    
    // Декодируем токен без проверки
    const decodedToken = jwtoken.decode(token);
    
    if (decodedToken && decodedToken.id) {
      // Отзываем все токены обновления пользователя
      await RefreshToken.revokeAllUserTokens(decodedToken.id);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Выход успешно выполнен'
    });
  } catch (error) {
    console.error('Ошибка при выходе из системы:', error);
    return res.status(200).json({
      success: true,
      message: 'Выход успешно выполнен'
    });
  }
};

/**
 * Получение информации о текущем пользователе
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.auth || !req.auth.id) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Не авторизован'
      });
    }
    
    const user = await User.findById(req.auth.id)
      .populate({
        path: 'company',
        populate: {
          path: 'currentTariff',
          model: 'Tariff'
        }
      });

    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        admin: user.admin,
        phone: user.phone,
        email: user.email,
        company: user.company
      }
    });
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Изменение пароля текущего пользователя
 * @param {Object} req - Express request 
 * @param {Object} res - Express response
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!req.auth || !req.auth.id) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Необходима авторизация'
      });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'Необходимо указать текущий и новый пароль'
      });
    }
          
    // Получаем пользователя
    const user = await User.findById(req.auth.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем текущий пароль
    const isPasswordValid = await verifyPassword(currentPassword, user.passHash);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'invalid_password',
        message: 'Текущий пароль неверен'
      });
    }

    // Проверяем сложность нового пароля
    const userData = {
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone
    };
    
    const passwordCheck = validatePasswordStrength(newPassword, userData);
    
    if (!passwordCheck.isStrong) {
      return res.status(400).json({
        success: false,
        error: 'weak_password',
        message: 'Пароль недостаточно надежный',
        passwordFeedback: {
          score: passwordCheck.score,
          suggestions: passwordCheck.feedback.suggestions,
          warning: passwordCheck.feedback.warning,
          estimatedCrackTime: passwordCheck.estimatedCrackTime
        }
      });
    }
    
    // Хешируем и сохраняем новый пароль
    user.passHash = await hashPassword(newPassword);
    await user.save();
    
    // Отзываем все существующие токены для усиления безопасности
    await RefreshToken.revokeAllUserTokens(user._id);
    
    return res.status(200).json({
      success: true,
      message: 'Пароль успешно изменен'
    });
  } catch (error) {
    console.error('Ошибка при смене пароля:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Проверка компании пользователя
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export const checkCompany = async (req, res, next) => {
  if (req.auth && !req.auth.company) {
    return res.status(404).json({ 
      success: false,
      error: 'company_not_found',
      message: 'Авторизуйтесь заново' 
    });
  } else {
    if (req.auth?.company) {
      try {
        const company = await Company.findById(req.auth.company._id);
        if (company) {
          req.company = company;
          next();
        } else {
          return res.status(404).json({ 
            success: false, 
            error: 'company_not_found',
            message: 'Авторизуйтесь заново' 
          });
        }
      } catch (error) {
        return res.status(500).json({ 
          success: false,
          error: 'server_error', 
          message: 'Ошибка при проверке компании' 
        });
      }
    } else {
      next();
    }
  }
};

/**
 * Middleware для проверки секретного ключа API
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Проверяем наличие ключа API в заголовках
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'missing_api_key',
      message: 'API ключ не предоставлен'
    });
  }
  
  // Проверяем валидность ключа API
  // Ключ можно хранить в конфигурации или в базе данных
  const validApiKey = cfg.service_api_key || process.env.SERVICE_API_KEY || 'your-secret-api-key-here';
  
  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      error: 'invalid_api_key',
      message: 'Недействительный API ключ'
    });
  }
  
  next();
};

/**
 * Генерирует случайный пароль заданной длины
 * @param {Number} length - Длина пароля
 * @returns {String} Сгенерированный пароль
 */
export const generateRandomPassword = (length = 12) => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  // Обеспечиваем наличие как минимум одного символа из каждой категории
  let password = 
    uppercase[Math.floor(Math.random() * uppercase.length)] +
    lowercase[Math.floor(Math.random() * lowercase.length)] +
    numbers[Math.floor(Math.random() * numbers.length)] +
    special[Math.floor(Math.random() * special.length)];
  
  // Добавляем остальные случайные символы
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Перемешиваем символы
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Генерирует уникальный одноразовый токен для автоматического логина
 * @param {Object} user - Объект пользователя
 * @returns {String} Одноразовый токен
 */
const generateAutoLoginToken = async (user) => {
  // Создаем случайный токен
  const autoLoginToken = crypto.randomBytes(32).toString('hex');
  
  // Создаем срок истечения (24 часа)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  // Сохраняем в базе данных
  await AutoLoginToken.create({
    userId: user._id,
    token: autoLoginToken,
    expiresAt,
    isUsed: false
  });
  
  return autoLoginToken;
};

/**
 * Проверка наличия активной сессии для номера телефона
 * @param {string} phone - Номер телефона
 * @param {string} type - Тип сессии (registration, login, password_reset)
 * @returns {Promise<Object>} Результат проверки { canProceed, message, cooldown }
 */
export const checkActiveSessionForPhone = async (phone, type) => {
  try {
    // Ищем активную сессию для данного номера и типа
    const existingSession = await AuthSession.findOne({
      phone,
      type,
      expiresAt: { $gt: new Date() }, // Сессия еще не истекла
    }).sort({ lastCodeSentAt: -1 }); // Берем самую свежую
    
    if (!existingSession) {
      return { canProceed: true };
    }
    
    // Проверяем, сколько времени прошло с последней отправки кода
    const now = Date.now();
    const cooldownSeconds = 60; // 1 минута в секундах
    const lastSent = new Date(existingSession.lastCodeSentAt).getTime();
    const secondsSinceLastSend = Math.floor((now - lastSent) / 1000);
    
    if (secondsSinceLastSend < cooldownSeconds) {
      // Не прошло 60 секунд с момента последней отправки
      const remainingSeconds = cooldownSeconds - secondsSinceLastSend;
      
      return {
        canProceed: false,
        message: `Пожалуйста, подождите ${remainingSeconds} секунд перед следующей попыткой`,
        cooldown: remainingSeconds,
        existingSessionId: existingSession.sessionId
      };
    }
    
    // Если сессия уже существует и прошло больше минуты, 
    // то можно использовать существующую сессию вместо создания новой
    return {
      canProceed: true,
      existingSession
    };
    
  } catch (error) {
    console.error(`Ошибка при проверке активной сессии для ${phone}:`, error);
    // При ошибке позволяем продолжить, чтобы не блокировать пользователя
    return { canProceed: true };
  }
};

/**
 * Автоматическая регистрация пользователя только по номеру телефона
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const autoRegister = async (req, res) => {
  try {
    let { phone, companyName } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'missing_phone',
        message: 'Не указан номер телефона'
      });
    }
    
    // Форматирование номера телефона
    phone = smsService.formatPhone(phone);
    // Проверка существующего пользователя
    let user = await User.findOne({ 'phone': phone });
    let isNewUser = false;
    let plainPassword = null;
    
    if (!user) {
      // Генерируем случайный пароль
      plainPassword = generateRandomPassword(12);
      const hashedPassword = await hashPassword(plainPassword);
      
      // Создаем компанию
      const company = await Company.create({
        name: companyName || `Компания ${phone}`
      });
      await assignStartTariff(company._id);
      // Создаем пользователя с автоматическими данными
      user = new User({
        login: phone,
        phone: phone,
        passHash: hashedPassword,
        is_active: true,
        admin: false,
        company: company._id
      });
      
      await user.save();
      isNewUser = true;
      handleInternalLeadBitrix(phone, "Новый пользователь NEUROUNIT", "")
    }
    
    // Генерируем токен для автоматического входа
    const autoLoginToken = await generateAutoLoginToken(user);
    
    // Создаем URL для автоматического входа
    const autoLoginUrl = `${cfg.autoLoginURL}${autoLoginToken}`;
    
    // Создаем токены доступа
    const token = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '24h' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    // Формируем минимальный ответ
    const response = {
      success: true,
      isNewUser,
      autoLoginUrl
    };
    
    // Добавляем пароль в ответ, если был создан новый пользователь
    if (isNewUser && plainPassword) {
      response.generatedPassword = plainPassword;
    }
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('Ошибка при автоматической регистрации:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Автоматический вход по одноразовому токену
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const autoLogin = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'missing_token',
        message: 'Не указан токен для автоматического входа'
      });
    }
    
    // Находим токен в базе данных
    const autoLoginTokenRecord = await AutoLoginToken.findOne({
      token,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!autoLoginTokenRecord) {
      return res.status(401).json({
        success: false,
        error: 'invalid_token',
        message: 'Недействительный или истекший токен для автоматического входа'
      });
    }
    
    // Получаем пользователя
    const user = await User.findById(autoLoginTokenRecord.userId).populate('company');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Отмечаем токен как использованный
    autoLoginTokenRecord.isUsed = true;
    await autoLoginTokenRecord.save();
    
    // Создаем токены доступа
    const accessToken = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '7d' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    // Создаем специальную сессию для возможности сбросить пароль
    const passwordResetSession = await AuthSession.createPasswordResetAfterAutologinSession(
      user._id,
      user.phone
    );
    
    return res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken,
      expiresIn: 86400 * 7, // 7 дней в секундах
      user: {
        id: user._id,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        admin: user.admin,
        phone: user.phone,
        email: user.email,
        company: user.company
      },
      // Добавляем информацию о сессии сброса пароля
      passwordReset: {
        available: true,
        sessionId: passwordResetSession.sessionId,
        expiresIn: passwordResetSession.expiresIn
      }
    });
  } catch (error) {
    console.error('Ошибка при автоматическом входе:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

/**
 * Установка нового пароля после автологина без указания старого пароля
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export const setPasswordAfterAutoLogin = async (req, res) => {
  try {
    const { sessionId, newPassword } = req.body;
    
    if (!sessionId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'missing_parameters',
        message: 'Не указаны необходимые параметры'
      });
    }
    
    // Получаем сессию специального типа
    const session = await AuthSession.findOne({
      sessionId,
      type: 'password_reset_after_autologin',
      expiresAt: { $gt: new Date() },
      verified: true
    });
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'invalid_session',
        message: 'Недействительная или истекшая сессия'
      });
    }
    
    // Проверяем, что сессия не была уже использована
    if (session.attempts >= session.maxAttempts) {
      return res.status(400).json({
        success: false,
        error: 'session_already_used',
        message: 'Сессия уже была использована'
      });
    }
    
    // Получаем пользователя
    const user = await User.findById(session.userData.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'user_not_found',
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем сложность нового пароля
    const userData = {
      login: user.login,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone
    };
    
    const passwordCheck = validatePasswordStrength(newPassword, userData);
    
    if (!passwordCheck.isStrong) {
      return res.status(400).json({
        success: false,
        error: 'weak_password',
        message: 'Пароль недостаточно надежный',
        passwordFeedback: {
          score: passwordCheck.score,
          suggestions: passwordCheck.feedback.suggestions,
          warning: passwordCheck.feedback.warning,
          estimatedCrackTime: passwordCheck.estimatedCrackTime
        }
      });
    }
    
    // Хешируем и сохраняем новый пароль
    user.passHash = await hashPassword(newPassword);
    await user.save();
    
    // Отмечаем сессию как использованную
    session.attempts = session.maxAttempts;
    await session.save();
    
    // Создаем новые токены доступа (опционально)
    const token = jwtoken.sign({
      id: user._id,
      admin: user.admin,
      company: user.company
    }, cfg.api_token, { expiresIn: '7d' });
    
    const refreshToken = jwtoken.sign({
      id: user._id,
      tokenType: 'refresh'
    }, cfg.refresh_token_secret || 'refresh-secret', { expiresIn: '30d' });
    
    // Сохраняем информацию о токене обновления
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней
    
    await RefreshToken.createToken(
      user._id,
      refreshToken,
      expiresAt,
      req.headers['user-agent'],
      req.ip
    );
    
    return res.status(200).json({
      success: true,
      message: 'Пароль успешно изменен',
      token,
      refreshToken,
      expiresIn: 86400 * 7, // 7 дней в секундах
    });
  } catch (error) {
    console.error('Ошибка при установке пароля после автологина:', error);
    return res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Внутренняя ошибка сервера'
    });
  }
};

export const assignStartTariff = async (companyId) => {
  const defaultBalance = 50;

  const startTariff = await Tariff.findOne({ default: true });

  const now = new Date();

  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 5);
  expiresAt.setHours(0, 0, 0, 0);

  await Company.findByIdAndUpdate(companyId, {
    balance: defaultBalance,
    currentTariff: startTariff?._id || null,
    tariffExpiresAt: startTariff ? expiresAt : null
  });
};

export default {
  login,
  startRegistration,
  verifyAndCompleteRegistration,
  startPhoneLogin,
  verifyPhoneLogin,
  requestPasswordReset,
  verifyPasswordReset,
  changePassword,
  refreshToken,
  resendCode,
  logout,
  getCurrentUser,
  getSession,
  checkCompany,
  validateApiKey,
  autoRegister,
  autoLogin,
  setPasswordAfterAutoLogin,
  generateRandomPassword,
  hashPassword,
  assignStartTariff
};