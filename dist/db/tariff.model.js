import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const schemaOptions = {
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
  },
  //  Цены фактические
  price: {
    type: Number,
    required: true
  },
  oldPrice: {
    type: Number,
  },
   //доп инфа, например, "Возможность доплаты до годового тарифа"
  discountNote: {
    type: String
  },
  durationDays: {
    type: Number,
    required: true
  },
  comment: {
    type: String,
  }
  // Включенные доп возможности 
  // integrations: {
  //   type: [String]
  // }
};


class TariffClass {}

const schema = new Schema(schemaOptions);
schema.loadClass(TariffClass);
const Tariff = mongoose.model('Tariff', schema);
export default Tariff;
