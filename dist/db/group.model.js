import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Схема профиля контакта
const schemaOptions = {
  _id:{type: String, required: true},
  idWA:{type: String},
  status:{type: String},
  type: { type: String},
  updated:{type : Date},
  company:{type : Schema.Types.ObjectId, ref : "Company"},
  reference:{type: String, default: null},
  participants: {type: Number, default: 0},
  title: { type: String, default: null },
  desc:{ type: String, default: null },
  shop:{ type: String, ref: 'Promocode', default: null },
  logo:{ type: String },
  banned: {type: Boolean},
  oldShop: {type: String},
  info: {type: String},
  lastJoined: {type: Date},
  revokeLink: {type: Date},
  groupTemplate : { type: String, default: null },
  template: {type: String},
  reanimation: {type: Boolean},
  reanimationReserve: {type: Boolean},
  lastNewsletter : {
    type : Date,
    default : new Date(2020, 1, 1)
  },
  admins:{type: Schema.Types.Mixed},
  waitToJoinGroup: {type: [String]},
  newAdmins: {type: [String]},
  outSourceReanimatorPhone: {type: String},
  registration: {type: Boolean},
  requiredPhones: {type: [String]}
}

const schema = new Schema(schemaOptions)
const Group = mongoose.model('Group', schema);
export default Group;