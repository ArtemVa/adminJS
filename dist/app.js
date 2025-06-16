import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express'
import Connect from 'connect-pg-simple'
import session from 'express-session'
import { buildAuthenticatedRouter } from '@adminjs/express';
import provider from './admin/auth-provider.js';
import options from './admin/options.js';
import initializeDb from './db/index.js';
import User from './db/user.model.js';
import { login } from './services/authService.js';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import router from './routes/index.js';
const port = process.env.PORT || 3000;
const start = async () => {
    const app = express();
    await initializeDb();
    const admin = new AdminJS(options);
    if (process.env.NODE_ENV === 'production') {
        await admin.initialize();
    }
    else {
        admin.watch();
    }

    const authenticate = async (email, password) => {
        const  result = await login(email, password);
        if(!result) return null
        return { email, company: result.company }

}
// await mongoose.connect('mongodb://localhost:27017/test', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });

  const sessionStore =  MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    autoRemove: 'native', // Автоматическая очистка истекших сессий
    ttl: 14 * 24 * 60 * 60
  });


// const sessionStore = MongoStore.create({
//     mongoUrl: `mongodb://localhost:27017/`,
//     collectionName: 'sessions',
//     ttl: 14 * 24 * 60 * 60, // Session TTL: 14 days
//     autoRemove: 'native', // Automatically remove expired sessions
//   });



    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: 'sessionsecret',
    },
    null,
    {
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: 'sessionsecret',
      cookie: {
        httpOnly: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV === 'production',
      },
      name: 'adminjs',
    }
  )
    app.use(admin.options.rootPath, adminRouter);
    app.use('/admin', router);
    // app.use(router);
    app.listen(port, () => {
        console.log(`AdminJS available at http://localhost:${port}${admin.options.rootPath}`);
    });
};
start();