import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const schemaOptions = {
  code: { type: String, required: true, unique: true },
  discountPercent: { type: Number },
  discountAmount: { type: Number },
  maxUses: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date },
  active: { type: Boolean, default: true }
};

class Payment_promocodeClass {}

const schema = new Schema(schemaOptions);
schema.loadClass(Payment_promocodeClass);
const Payment_promocode = mongoose.model('Payment_promocode', schema);
export default Payment_promocode;
