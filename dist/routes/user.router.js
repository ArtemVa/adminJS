import express from 'express';
import mongoose from 'mongoose';
import Channel from "../db/channel.model.js";
import User from '../db/user.model.js';

const router = express.Router();
const ObjectId = mongoose.Types.ObjectId;

router.route('/')
.get(async (req, res, next) => {
    try {
    if(!req.session.adminUser.company){
        return res.status(400)
    }
    
    const result = await User.ListWithPagination(req.query)
    return res.status(200).json(result)
    } catch (err) {
        next(err);
    }
  })

router.route('/set-tariff')


export default router;