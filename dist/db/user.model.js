import mongoose from 'mongoose';
import moment_tz from 'moment-timezone';

const Schema = mongoose.Schema;

const schemaOptions = {
  firstName : {
    type : String,
  },
  lastName : {
    type : String,
  },
  login : {
    type : String,
  },
  email : {
    type : String,
  },
  phone : {
    type : String,
    unique : true,
    require : true
  },
  passHash : {
    type : String,
  },
  admin : {
    type : Boolean,
    default : false
  },
  is_active : {
    type : Boolean,
    default : true
  },
  created: {
    type: Date,
    default: () => {
      const date = moment_tz.tz("Europe/Moscow");
      return date.toDate();
    },
  },
};

const schema = new Schema(schemaOptions)
const User = mongoose.model('User', schema);

export default User