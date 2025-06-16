import crypto from 'crypto';
import cfg from '../config/srv.cfg.js'

const {
  robo_merchant,
  robo_password1,
  robo_password2,
  robo_test_password1,
  robo_test_password2,
  robo_is_test
} = cfg.robokassa;

const isTest = robo_is_test === 'true';

function generatePaymentLink({ amount, billId, description }) {
  const sum = parseFloat(amount).toFixed(2);
  const pass1 = isTest ? robo_test_password1 : robo_password1;
  const receipt = {
    sno: 'usn_income',
    items: [
      {
        name: description || 'Пополнение баланса личного кабинета',
        quantity: 1,
        sum: Number(sum),
        payment_method: 'full_payment',
        payment_object: 'service',
        tax: 'none'
      }
    ]
  };

  const receiptJson = JSON.stringify(receipt);
  const signatureBase = `${robo_merchant}:${sum}:${billId}:${receiptJson}:${pass1}`;
  const signature = crypto.createHash('md5').update(signatureBase).digest('hex');
  const receiptEncoded = encodeURIComponent(receiptJson);

  let url = `https://auth.robokassa.ru/Merchant/Index.aspx?` +
    `MerchantLogin=${robo_merchant}` +
    `&OutSum=${sum}` +
    `&InvId=${billId}` +
    `&Description=${encodeURIComponent(description)}` +
    `&SignatureValue=${signature}` +
    `&Receipt=${receiptEncoded}`;

  if (isTest) url += '&IsTest=1';

  return url;
}

function isValidResultSignature({ OutSum, InvId, SignatureValue }) {
  const pass2 = isTest ? robo_test_password2 : robo_password2;

  const expected = crypto
    .createHash('md5')
    .update(`${OutSum}:${InvId}:${pass2}`)
    .digest('hex');

  return expected.toUpperCase() === SignatureValue.toUpperCase();
}

export default {
  generatePaymentLink,
  isValidResultSignature
};
