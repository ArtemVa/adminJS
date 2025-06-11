import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const schemaOptions = {
  _id : {
    type : String,
  },
  desc : {
    type : String,
  },
  message : {
    type : String,
  },
  promocode : {
    type : String,
    require : true,
    unique : true
  },
  type : {
    type: String,
  },
  client : {
    type : Schema.Types.ObjectId,
    ref: 'Client',
  },
  company : {
    type : Schema.Types.ObjectId,
    ref: 'Company',
    require : true
  },
  counter: { 
    type: Number, 
    default: 0 
  },
  store : {
    type: String,
  },
};



const schema = new Schema(schemaOptions, { _id: false })

schema.pre('save', function(next) {
  var doc = this;
  Counter.findByIdAndUpdate({_id: 'promocodes'}, {$inc: { seq: 1} }, function(error, counter)   {
      if (error) return next(error);
      const promocode = String(counter.seq).padStart(5, '0');
      doc.promocode = promocode;
      doc._id = promocode;
      next();
  });
});

const Promocode = mongoose.model('Promocode', schema);
export default  Promocode