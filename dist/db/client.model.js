import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const schemaOptions = {
  channel: {
    type : Schema.Types.ObjectId,
    ref: 'Channel'
  },
  serviceType: { 
    type: String, 
    required: true 
  },
  username: { 
    type: String 
  },
  serviceId: { 
    type: String 
  },
  projectId : {
    type : Schema.Types.ObjectId,
    ref: "Project"
  },
  reservChannels: [{
    type : Schema.Types.ObjectId,
    ref: 'Channel',
    default : []
  }],
  created : {
    type: Date
  },
  name : {
    type: String
  },
  phone : {
    type: String
  },
  firstMessage : {
    type: String,
  },
  promocode : {
    type : String,
    ref: 'Promocode'
  },
  referer : {
    type : String,
    ref: 'Promocode'
  },
  groupPromocode : {
    type : String,
    ref: 'Promocode'
  },
  registered : {
    type: Boolean,
    required: true,
    default : false
  },
  lastSentMessage : {
    type: Date,
  },
  lastWebSentMessage : {
    type: Date,
  },
  registrationTimestamp : {
    type: Date,
  },
  npsCheck: {
    type: Boolean,
  },
  company : {
    type : Schema.Types.ObjectId,
    ref: 'Company'
  },
  firstOut : {
    type: Date,
  },
  firstIn : {
    type: Date,
  },
  lastOut : {
    type: Date,
  },
  lastIn : {
    type: Date,
  },
  tags : [{
    type : String
  }],
  status : {
    type : String
  },
  type : {
    type : String
  },
  subscription : {
    type : Number
  },
  subscriptionTimestamp : {
    type : Date
  },
  lastNewsletter : {
    type : Date,
    default : new Date(2020, 1, 1)
  },
  groupId : {
    type : String
  },
  joinedGroup : {
    type : Date
  },
  leftGroup : {
    type : Date
  },
  lastChannel : {
    type : Schema.Types.ObjectId,
    ref: 'Channel'
  },
  oldChannel : {
    type : Schema.Types.ObjectId,
    ref: 'Channel'
  },
  counterOfImpressions: {
    type: Number
  },
  reanimation : {
    type : Date
  },
  vcfRequests: {
    type: Number
  },
  lastRequestTime: {
    type: Date
  },
  id_1c : { 
    type: String, 
  },
  sync_1c:{
    type: Boolean
  },
  confirmCode: {
    type: String
  },
  history: {
    type: [Object]
  },
  reanimationGroup: {
    type: String
  },
  forOutSource: {
    type: String
  },
  freeze: {
    type: Boolean
  },
  outSourceReanimator: {
    type: Boolean
  },
  startDayOfFreeze: {
    type: Date
  },
  outSourcePromocodes: {
    type: [String]
  },
  waitPayment: {
    type: Boolean
  },
  warmuper: {
    type: Boolean
  },
  chatGPT : {
    conversationId : {
      type : String
    }, 
    parentMessageId : {
      type : String
    }
  },
  seller: {
    type: Boolean
  },
  sellerTransferGroup: {
    type: Boolean
  }
};

// Составные индексы
const schema = new Schema(schemaOptions)
const Client = mongoose.model('Client', schema);
export default  Client;