import express from 'express';
import mongoose from 'mongoose';
import Newsletter from '../db/newsletter.model.js';
import Channel from '../db/channel.model.js';

const router = express.Router();
const ObjectId = mongoose.Types.ObjectId;

router.route('')
.get((req, res, next) => {
    const filter = req.body || {};
    if(!req.session.adminUser.company){
        return res.status(400)
    }
    
    filter.company = new ObjectId(req.session.adminUser.company._id);
    let details = req.query.details || "ext";
    Channel.ListWithPagination(filter, req.query, details)
      .then((result) => {
        res.json(result);
      }, (err) => next(err))
      .catch((err) => next(err));
  })

export default router;