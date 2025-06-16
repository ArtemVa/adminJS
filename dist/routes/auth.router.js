import express from 'express';
import { expressjwt as jwt } from "express-jwt";
import authService from '../services/authService.js';
import cfg from '../config/srv.cfg.js';
import { buildAuthenticatedRouter } from '@adminjs/express';
import options from '../admin/options.js';
import AdminJS from 'adminjs';
import provider from "../admin/auth-provider.js";

const router = express.Router();
const admin = new AdminJS(options);
    if (process.env.NODE_ENV === 'production') {
        await admin.initialize();
    }
    else {
        admin.watch();
    }

// Middleware для проверки инициализации сессии
const requireSession = async (req, res, next) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'missing_session',
      message: 'Не указан идентификатор сессии'
    });
  }
  
  const session = await authService.getSession(sessionId);
  
  if (!session) {
    return res.status(400).json({
      success: false,
      error: 'invalid_session',
      message: 'Сессия не найдена или истекла'
    });
  }
  
  req.session = session;
  next();
};

// Стандартная авторизация по логину/паролю
router.post('/login', buildAuthenticatedRouter(admin, {
    cookiePassword: process.env.COOKIE_SECRET,
    cookieName: 'adminjs',
    provider
}, null, {
    secret: process.env.COOKIE_SECRET,
    saveUninitialized: true,
    resave: true,
}));

// Начало SMS-регистрации (в новой версии собираем все данные на этом этапе)
router.post('/register/phone', authService.startRegistration);

// Подтверждение SMS-кода при регистрации и завершение регистрации
router.post('/register/verify', requireSession, authService.verifyAndCompleteRegistration);

// Начало SMS-авторизации
router.post('/login/phone', authService.startPhoneLogin);

// Подтверждение SMS для авторизации
router.post('/login/verify', requireSession, authService.verifyPhoneLogin);

// Запрос на сброс пароля
router.post('/reset-password/request', authService.requestPasswordReset);

// Подтверждение сброса пароля
router.post('/reset-password/verify', requireSession, authService.verifyPasswordReset);

// Обновление токена
router.post('/refresh-token', authService.refreshToken);

// Запрос повторной отправки SMS
router.post('/resend-code', requireSession, authService.resendCode);

// Выход из системы (Logout)
router.post('/logout', authService.logout);

router.post('/change-password', jwt({ secret: cfg.api_token, algorithms: ["HS256"] }), authService.changePassword);

// Автоматическая регистрация только с номером телефона (защищенный API ключом)
router.post('/auto-register', authService.validateApiKey, authService.autoRegister);

// Автоматический вход по одноразовому токену
router.post('/auto-login', authService.autoLogin);

// Установка пароля после автологина (без указания старого пароля)
router.post('/set-password-after-autologin', authService.setPasswordAfterAutoLogin);

// Получение информации о текущем пользователе
router.get('/me', jwt({ secret: cfg.api_token, algorithms: ["HS256"] }), authService.getCurrentUser);


export default router;