import mongoose from 'mongoose';
import crypto from 'crypto';

const Schema = mongoose.Schema;

// Сессии аутентификации
const authSessionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phone: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['registration', 'login', 'password_reset', 'password_reset_after_autologin'],
    required: true
  },
  code: {
    type: String,
    required: function() {
      // Для типа password_reset_after_autologin код не обязателен
      return this.type !== 'password_reset_after_autologin';
    }
  },
  expiresAt: {
    type: Date,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  userData: {
    type: Schema.Types.Mixed,
    default: {}
  },
  lastCodeSentAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Индексы для эффективного поиска и автоматической очистки истекших сессий
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Создание сессии для процесса регистрации/авторизации по SMS
authSessionSchema.statics.createSession = async function(phone, type, userData = {}) {
  const sessionId = crypto.randomBytes(20).toString('hex');
  
  // Для типа password_reset_after_autologin код не генерируем
  const code = type === 'password_reset_after_autologin' 
    ? null 
    : Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join('');
  
  // Устанавливаем срок действия сессии в зависимости от типа
  const expirationMinutes = type === 'password_reset_after_autologin' ? 24 * 60 : 5; // 24 часа или 5 минут
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  
  // Устанавливаем, подтверждена ли сессия изначально
  const initiallyVerified = type === 'password_reset_after_autologin';
  
  const session = await this.create({
    sessionId,
    phone,
    type,
    code,
    expiresAt,
    userData,
    lastCodeSentAt: new Date(),
    verified: initiallyVerified
  });
  
  return {
    sessionId,
    expiresIn: expirationMinutes * 60, // в секундах
    type,
    code // Возвращаем код для отправки по SMS (или null для password_reset_after_autologin)
  };
};

// Создание специальной сессии для сброса пароля после автологина
authSessionSchema.statics.createPasswordResetAfterAutologinSession = async function(userId, phone) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 часа
  
  const session = await this.create({
    sessionId,
    phone,
    type: 'password_reset_after_autologin',
    code: null, // Код не требуется
    expiresAt,
    maxAttempts: 1, // Только одна попытка
    userData: {
      userId: userId,
      noOldPasswordRequired: true // Флаг, что старый пароль не нужен
    },
    verified: true // Сессия изначально подтверждена
  });
  
  return {
    sessionId: session.sessionId,
    expiresIn: Math.floor((session.expiresAt - new Date()) / 1000)
  };
};

// Получение сессии по идентификатору
authSessionSchema.statics.getActiveSession = async function(sessionId) {
  const session = await this.findOne({ 
    sessionId,
    expiresAt: { $gt: new Date() }
  });
  
  return session;
};

// Обновление кода в сессии
authSessionSchema.methods.updateCode = async function() {
  // Если это сессия типа password_reset_after_autologin, код не обновляем
  if (this.type === 'password_reset_after_autologin') {
    return null;
  }
  
  const newCode = Array.from({length: 6}, () => Math.floor(Math.random() * 10)).join('');
  this.code = newCode;
  this.lastCodeSentAt = new Date();
  await this.save();
  
  return newCode;
};

// Модель обновления токенов для безопасного обновления JWT
const refreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  userAgent: String,
  ipAddress: String
}, {
  timestamps: true
});

// Индекс для автоматической очистки истекших токенов
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Поиск активного токена
refreshTokenSchema.statics.findActiveToken = async function(userId, token) {
  return await this.findOne({
    userId,
    token,
    expiresAt: { $gt: new Date() },
    isRevoked: false
  });
};

// Отзыв всех токенов пользователя
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return await this.updateMany(
    { userId, isRevoked: false },
    { isRevoked: true }
  );
};

// Отзыв всех токенов пользователя, кроме текущего
refreshTokenSchema.statics.revokeAllUserTokensExceptCurrent = async function(userId, currentToken) {
  try {
    // Находим текущий токен в базе данных
    const currentTokenRecord = await this.findOne({
      userId,
      token: currentToken,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    });
    
    // Отзываем все токены, кроме найденного
    return await this.updateMany(
      { 
        userId,
        _id: { $ne: currentTokenRecord ? currentTokenRecord._id : null },
        isRevoked: false
      },
      { isRevoked: true }
    );
  } catch (error) {
    console.error('Ошибка при отзыве токенов:', error);
    return { modifiedCount: 0 };
  }
};

// Создание нового токена
refreshTokenSchema.statics.createToken = async function(userId, token, expiresAt, userAgent, ipAddress) {
  return await this.create({
    userId,
    token,
    expiresAt,
    userAgent,
    ipAddress
  });
};

// Модель для одноразовых токенов автоматического входа
const autoLoginTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Индекс для автоматической очистки истекших токенов
autoLoginTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AutoLoginToken = mongoose.model('AutoLoginToken', autoLoginTokenSchema);
const AuthSession = mongoose.model('AuthSession', authSessionSchema);
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

export {
  AuthSession,
  RefreshToken,
  AutoLoginToken
};