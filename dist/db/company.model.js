import mongoose from 'mongoose';
const Schema = mongoose.Schema;


const schemaOptions = {
  name : {
    type : String,
    require : true
  },
  balance : {
    type : Number
  },
  currentTariff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tariff'
  },
  tariffExpiresAt: {
    type: Date
  }  
}

class CompanyClass {

}

const schema = new Schema(schemaOptions)


schema.loadClass(CompanyClass);
const Company = mongoose.model('Company', schema);
export default  Company;