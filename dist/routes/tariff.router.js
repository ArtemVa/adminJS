import express from 'express';
import Tariff from '../db/tariff.model.js';
import Bill from '../db/bill.model.js';
import Company from '../db/company.model.js';
import Payment_promocode from '../db/paymentPromocode.model.js';
import RobokassaService from '../services/Robokassa.js';
import mongoose from 'mongoose';

const router = express.Router();
const ObjectId = mongoose.Types.ObjectId;

router.get('/', async (req, res, next) => {
  try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }
    const list = await Tariff.find();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/company/:companyId/active', async (req, res, next) => {
  try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }

    const company = await Company.findById(req.session.adminUser.company._id);
    if (!company || !company.currentTariff || !company.tariffExpiresAt) {
      return res.json({ tariff: null });
    }

    if (company.tariffExpiresAt < new Date()) {
      return res.json({ tariff: null });
    }

    const tariff = await Tariff.findById(company.currentTariff);
    res.json({
      tariff,
      expiresAt: company.tariffExpiresAt
    });
  } catch (err) {
    next(err);
  }
});

router.post('/buy', async (req, res, next) => {
  try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }

    const { companyId, userId, tariffId, payment_promocode } = req.body;
    if (!ObjectId.isValid(companyId) || !ObjectId.isValid(userId) || !ObjectId.isValid(tariffId)) {
      return res.status(400).json({ error: 'Invalid params' });
    }

    const [tariff, company] = await Promise.all([
      Tariff.findById(tariffId),
      Company.findById(companyId)
    ]);
    if (!tariff) return res.status(404).json({ error: 'tariff not found' });

    if (
      company?.currentTariff &&
      company.tariffExpiresAt &&
      company.tariffExpiresAt > new Date()
    ) {
      const currentTariff = await Tariff.findById(company.currentTariff);
      if (currentTariff?.name !== "Базовый") {
        return res.status(400).json({
          error: 'У компании уже есть активный тариф до ' + company.tariffExpiresAt.toISOString()
        });
      }
    }

    let finalPrice = tariff.price;
    let promo = null;

    if (payment_promocode) {
      promo = await Payment_promocode.findOne({
        code: payment_promocode.toUpperCase(),
        active: true
      });

      if (
        !promo ||
        (promo.expiresAt && promo.expiresAt < new Date()) ||
        (promo.maxUses && promo.usedCount >= promo.maxUses)
      ) {
        return res.status(400).json({ error: 'Promocode is invalid' });
      }

      const existingUse = await Bill.findOne({
        userId,
        promocode: promo._id
      });

      if (existingUse) {
        return res.status(400).json({ error: 'You have already used this promocode' });
      }

      if (promo.discountPercent) {
        finalPrice -= finalPrice * (promo.discountPercent / 100);
      } else if (promo.discountAmount) {
        finalPrice -= promo.discountAmount;
      }
      if (finalPrice < 0) finalPrice = 0;

      finalPrice = Math.round(finalPrice * 100) / 100;

      promo.usedCount++;
      await promo.save();
    }

    const bill = await Bill.create({
      companyId,
      userId,
      amount: finalPrice,
      tariffId,
      promocode: promo?._id
    });

    const link = RobokassaService.generatePaymentLink({
      amount: finalPrice,
      billId: bill._id,
      description: `Покупка тарифа ${tariff.name}${promo ? ` (промокод ${promo.code})` : ''}`
    });

    res.json({ link });
  } catch (err) {
    next(err);
  }
});
  
router.post('/buy/from-balance', async (req, res, next) => {
try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }
      const { companyId, userId, tariffId } = req.body;
  
      if (!ObjectId.isValid(companyId) || !ObjectId.isValid(userId) || !ObjectId.isValid(tariffId)) {
        return res.status(400).json({ error: 'Неверные параметры' });
      }
  
      const [company, tariff] = await Promise.all([
        Company.findById(companyId),
        Tariff.findById(tariffId)
      ]);
  
      if (!company) return res.status(404).json({ error: 'Компания не найдена' });
      if (!tariff) return res.status(404).json({ error: 'Тариф не найден' });

      const now = new Date();
      if (company.currentTariff && company.tariffExpiresAt && company.tariffExpiresAt > now) {
        return res.status(400).json({ error: 'У компании уже есть активный тариф' });
      }

      if ((company.balance || 0) < tariff.price) {
        return res.status(400).json({ error: 'Недостаточно средств на балансе компании' });
      }
  
      company.balance -= tariff.price;
  
      company.currentTariff = tariff._id;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + tariff.durationDays);
      company.tariffExpiresAt = expiresAt;
  
      await company.save();
  
      await Bill.create({
        userId,
        companyId,
        amount: tariff.price,
        tariffId,
        status: 'paid'
      });
  
      res.json({
        message: 'Тариф успешно активирован за счёт баланса компании',
        expiresAt
      });
  
    } catch (err) {
      next(err);
    }
  });
    
router.get('/:id', async (req, res, next) => {
  try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }
    const tariff = await Tariff.findById(req.params.id);
    if (!tariff) return res.status(404).json({ error: 'tariff not found' });
    res.json(tariff);
  } catch (err) {
    next(err);
  }
});

export default router;