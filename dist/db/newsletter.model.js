import mongoose from 'mongoose';
import moment_tz from 'moment-timezone';
import {NEWSLETTER_STATUS, NEWSLETTER_TYPES as TYPES, NEWSLETTER_STATS as STATS } from "../consts/index.js";
const ObjectId = mongoose.Types.ObjectId;
const Schema = mongoose.Schema;

const schemaOptions = {
  user : {
    type : Schema.Types.ObjectId,
    ref: 'User',
    required: true 
  },
  company: {
    type : Schema.Types.ObjectId,
    ref: 'Company',
    required: true 
  },
  type : {
    type : String,
  },
  toService: { 
    type: String, 
  },
  group : {
   type : Boolean,
  },
  contacts: [{
    username: String,
    phone: String,
    id: String,
  }],
  created : {
    type : Date,
    default : new Date()
  },
  desc : {
    type : String,
  },
  title : {
    type : String,
  },
  projectTitle : {
    type : String,
  },
  status : {
    type : String,
    default : NEWSLETTER_STATUS.Creating
  },
  timeTo : {
    type : String,
  },
  timeFrom : {
    type : String,
  },
  dateTo : {
    type : Date,
  },
  dateFrom : {
    type : Date,
  },
  speed: {
    type: Number
  },
  outgoing_limit: {
    type: Number
  },
  priority : {
    type : Number,
    default : 1
  },
  phones : {
    type : Schema.Types.Mixed
  },
  text : {
    type : String
  },
  tag : {
    type : String,
  },
  finished : {
    type : Date,
  },
  useReservChannel : {
    type : Boolean,
  },
  channels : [{
    type : Schema.Types.ObjectId,
    ref: "Channel"
  }],
  clients : {
    type : Number
  },
  media : {
    type : String,
  },
  projectId : {
    type : Schema.Types.ObjectId,
    ref: "Project"
  },
  restarted : {
    type : Date,
  },
};

const newsletter_item_schema  = {
  channel : {
    type : Schema.Types.ObjectId,
    ref: "Channel"
  },
  client : {
    type : Schema.Types.ObjectId,
    ref: "Client"
  },
  group : {
    type : String,
    ref: "Group"
  },
  newsletter : {
    type : Schema.Types.ObjectId,
    ref: "Newsletter"
  },
  status : {
    type : String,
    ref: "Status"
  },
  created : {
    type : Date,
  },
  order : {
    type : Number,
  },
  lastQueue: {
    type: Date,
    default: null
  },
}

const newsletter_stat_schema  = {
  channel : {
    type : Schema.Types.ObjectId,
    ref: "Channel"
  },
  newsletter : {
    type : Schema.Types.ObjectId,
    ref: "Newsletter"
  },
  intervalType : {
    type : String,
  },
  interval : {
    type : Date,
  },
  stat : {
    type : String,
  },
  value : {
    type : Number,
  },
}

const schema = new Schema(schemaOptions)
const Newsletter = mongoose.model('Newsletter', schema);
const NewsletterItem = mongoose.model('NewsletterItem', new Schema(newsletter_item_schema));
const NewsletterStat = mongoose.model('NewsletterStat', new Schema(newsletter_stat_schema));
export default  Newsletter;