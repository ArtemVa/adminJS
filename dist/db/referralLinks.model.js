import mongoose from 'mongoose';
import User from '../db/user.model.js';
import Bill from './bill.model.js';
import { generateRandomPassword, hashPassword, assignStartTariff } from '../services/authService.js';
import smsService from '../services/smsService.js';
import Company from '../db/company.model.js';

const Schema = mongoose.Schema;

const schemaOptions = {
  link: {
    type: String,
    default: () => Math.random().toString().slice(2, 11 + Math.floor(Math.random() * 4)),
    unique: true
  },
  linkViewed: {
    type: Number,
    default: 0,
  },
  earned: {
    type: Number,
    default: 0,
  },
  wallet: {
    type: Number,
    default: 0,
  },
  lastReferralRegistration: {
    type: Date,
    default: null,
  },
  referralRegistrationCount: { // in one day
    type: Number,
    default: 0,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
};

class ReferralLinksClass {
  static async getLink(userId) {
    const link = await this.findOne({ user: userId });
    if (link) {
      return { link: link.link };
    }
    const newLink = await this.create({ user: userId });
    return { link: newLink.link };
  }

  static async incrementLinkView(link) {
    const referralLink = await this.findOne({ link: link.toString() });
    if (referralLink) {
      referralLink.linkViewed += 1;
      await referralLink.save();
    }
    return { success: true };
  }

  static async getInfo(userId) {
    const link = await this.findOne({ user: userId });
    if (link) {
      const registeredUsers = await User.find({ origin: userId });
      const balancePayedUsers = registeredUsers.length > 0 ? await Bill.countDocuments({ userId: { $in: registeredUsers.map(user => user._id) }, status: 'paid' }) : 0;
      return {
        link: link.link,
        earned: link.earned,
        wallet: link.wallet,
        linkViewed: link.linkViewed,
        registered: registeredUsers.length,
        balancePayed: balancePayedUsers
      };
    }
    return null;
  }
  static async getFullInfoWithFilter(userId, filter) {
    const link = await this.findOne({ user: userId });

    if (link) {
      const registeredUsers = await User.find({ 
        origin: userId, 
        created: { 
          $gte: filter.startDate, 
          $lte: filter.endDate 
        } 
      })
      const balancePayedUsers = await Bill.find({ 
        userId: { $in: registeredUsers.map(user => user._id) }, 
        tariffId: { $ne: null }, 
      }).populate('tariffId');
      return registeredUsers.map(user => {
        const bill = balancePayedUsers.find(bill => bill.userId.toString() === user._id.toString());
        return {
          userId: user._id,
          created: user.created,
          login: user.email,
          tariff: bill?.tariffId ? bill.tariffId.name : null,
          sum: bill ? bill.amount : null,
          reward: bill?.tariffId ? (bill.tariffId.price * 0.1) : null,
        };
      });
    }
    return [];
  }

  // auto registration user 
  static async referralRegistration(userId, credentials, res) {
    let password = null;
    let phone = null;
    const link = await this.findOne({ user: userId });
    if (!link) {
      return res.status(400).json({ success: false, error: 'Реферальные данные не найдены, попробуйте снова.' });
    } else if (link.lastReferralRegistration && !(link.lastReferralRegistration.toDateString() === new Date().toDateString())) {
      // resets the registration meter and updates the date of the last registration. Data is purely technical
      link.referralRegistrationCount = 0;
      link.lastReferralRegistration = new Date();
    } 
    if (link.referralRegistrationCount >= 3) {
      return res.status(400).json({ success: false, error: 'Вы исчерпали лимит 3 регистраций в сутки, приходите завтра или воспользуйтесь реферальной ссылкой' });
    }
    try {
      // Генерируем случайный пароль
      password = generateRandomPassword(12);
      const hashedPassword = await hashPassword(password);
      
      phone = smsService.formatPhone(credentials.phone);

      // Создаем компанию
      const company = await Company.create({
        name: `Компания ${phone}`
      });
      await assignStartTariff(company._id);
      // Создаем пользователя с автоматическими данными
      const user = new User({
        login: phone,
        phone: phone,
        email: credentials.email,
        passHash: hashedPassword,
        is_active: true,
        admin: false,
        company: company._id,
        origin: userId,
      });
      
      await user.save();
    } catch (error) {
      console.error('Ошибка при автоматической регистрации реферала:', error);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
      });
    }
    // Увеличиваем счетчик регистраций
    link.referralRegistrationCount += 1;
    link.save()
    
    await smsService.sendSms({to: phone, text: `Поздравляем, ваш друг зарегистрировал вас на платформе https://app.neurounit.ai ! Логин: ${phone} Пароль: ${password}`})
    return {success: true}
  }
}

const schema = new Schema(schemaOptions);

schema.loadClass(ReferralLinksClass);
const ReferralLinks = mongoose.model('ReferralLinks', schema);
export default  ReferralLinks;