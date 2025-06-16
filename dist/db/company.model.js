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
 static async SetBalance(company, balance) {
    const result = await Company.findOneAndUpdate({company: new mongoose.Types.ObjectId(company)}, {$set: {balance}}, {new: true})
    return JSON.stringify(result, null, 2);
  }

  static async SetTariff(company, currentTariff) {
    const result = await Company.findOneAndUpdate({company: new mongoose.Types.ObjectId(company)}, {$set: {currentTariff}}, {new: true})
    return JSON.stringify(result, null, 2);
  }

  static async DeleteTariff(company) {
    const result = await Company.findOneAndUpdate({company: new mongoose.Types.ObjectId(company)}, {$set: {currentTariff: null}}, {new: true})
    return JSON.stringify(result, null, 2);
  }
}

const schema = new Schema(schemaOptions)


schema.loadClass(CompanyClass);
const Company = mongoose.model('Company', schema);
export default  Company;