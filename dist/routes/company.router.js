import express from 'express';
import mongoose from 'mongoose';
import Channel from "../db/channel.model.js";
import Tariff from '../db/tariff.model.js';

const router = express.Router();
const ObjectId = mongoose.Types.ObjectId;

router.route('/set')
.post((req, res, next) => {
    if(!req.session.adminUser.company){
        return res.status(400)
    }

    if(!req.body.company || req.body.balance){
        return res.status(401);
    }
    
    Channel.SetBalance(req.body.company, req.body.balance)
      .then((result) => {
        res.json(result);
      }, (err) => next(err))
      .catch((err) => next(err));
  })

router.route('/set-tariff')
.post(async (req, res, next) => {
  try{
    if(!req.session.adminUser.company){
        return res.status(400)
    }

    if(!req.body.company || req.body.tariff){
        return res.status(401);
    }
    
    const tariff = await Tariff.findOne({name: req.body.tariff})
    if(!tariff) {
      return res.json(404)
    }
    const result = await Channel.SetTariff(req.body.company, tariff._id)
    return res.json(result);
  } catch(err) {
      next(err)
  };
})

router.route('/delete-tariff')
.post(async (req, res, next) => {
  try{
    if(!req.session.adminUser.company){
        return res.status(400)
    }

    if(!req.body.company || req.body.tariff){
        return res.status(401);
    }
    
    const result = await Channel.DeleteTariff(req.body.company)
    return res.json(result);
  } catch(err) {
      next(err)
  };
})

export default router;