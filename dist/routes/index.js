import express from 'express';
import newsletters from './newsletter.route.js';
import channel from "./channel.router.js";
import tariff from "./tariff.router.js";
import companies from "./company.router.js";
import users from "./user.router.js";
const router = express.Router();

  /* GET home page. */
router.get('/', (req, res) => {
  res.send('I\'m the main server! What are you looking for?')
})
  
router.use('/newsletters', newsletters);
router.use('/channels', channel);
router.use('/tariff', tariff)
router.use('/companies', companies)
router.use('/users', users)

export default router;