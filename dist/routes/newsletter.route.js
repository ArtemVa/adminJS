import express from 'express';
import mongoose from 'mongoose';
import Newsletter from '../db/newsletter.model.js';

const router = express.Router();
const ObjectId = mongoose.Types.ObjectId;

router.route('')
.get(async (req, res, next) => {
    try{
        if(!req.session.adminUser.company){
            return res.status(400)
        }

        const filter = req.body || {};
        filter.company = new ObjectId(req.session.adminUser.company._id);
        const result = await Newsletter.ListWithPagination(filter, req.query);
        return res.json(result);
    } catch (err){
        next(err);
    }
})

export default router;