import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const schemaOptions = {
  _id: {
    type: Number,
    default: () => Math.floor(100_000_000 + Math.random() * 900_000_000)
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  transactionId: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  tariffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tariff'
  },
  default: {
    type: Boolean,
    default: false
  },
  promocode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment_promocode',
    default: null
  }
  
};


class BillClass {}

const schema = new Schema(schemaOptions);
schema.loadClass(BillClass);
const Bill = mongoose.model('Bill', schema);

export default Bill;
