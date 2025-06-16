import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const STATUSES = {
  READY: "Ready"
}

const SOURCE_CHOICES = ['telegram', 'avito', 'whatsapp', 'instagram'];
const STATUS_CHOICES = ['unauthorized', 'authorized', 'banned'];

const regStateShema = {
  nextCallRequest: {
    type: Date,
  },
  nextSmsRequest: {
    type: Date,
  },
  appState : {
    type: String
  },
  webState : {
    type: String
  },
  regState : {
    type: String
  },
  techState : {
    type: String,
  }
};

const softDeletePlugin = (schema) => {
  schema.add({
    deletedAt: { type: Date, default: null },
    restored_at: { type: Date, default: null },
  });

  schema.pre(/^find/, function (next) {
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
      this.where({ deletedAt: null });
    }
    next();
  });

  schema.methods.softDelete = function () {
    this.deletedAt = new Date();
    this.restored_at = null;
    return this.save();
  };

  schema.methods.restore = function () {
    this.deletedAt = null;
    this.restored_at = new Date();
    return this.save();
  };
};

const schemaOptions = {
  phone: {
    type: String,
    required: true,
    unique: true
  },
  sendToContact: {
    type: Boolean,
    default: true
  },
  company: {
    type: Schema.Types.ObjectId,
    ref: "Company",
  },
  desc: {
    type: String,
  },
  speed: {
    type: Number,
    default: 60
  },
  forSend: {
    type: Boolean,
    default: false
  },
  enableChatBot: {
    type: Boolean,
    default: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  forReg: {
    type: Boolean,
    default: true
  },
  forOnboard: {
    type: Boolean,
    default: false
  },
  forTransactions: {
    type: Boolean,
    default: false
  },
  useAutoWarmUp: {
    type: Boolean,
    default: false
  },
  lastSentMessage: {
    type: Date,
  },
  forTest: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    default: "Creating"
  },
  startForReg:{
    type: Date,
  },
  containerStatus:{
    type: Boolean,
    default: false
  },
  useChatGPT: {
    type: Boolean,
    default: false
  },
  regState: regStateShema,
  speedHistory : [{
    from: {
      type: Date,
    },
    speed: { //"requestingSMS", "requestingCall", "PendingCode", "Awaiting"
      type: Number
    },
  }],
  admin: {type: Boolean},
  role: {type: String},
  banned: {type: Boolean},
  project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  title: { type: String, required: true, maxlength: 1000 }, // заменить на desc
  is_active: { type: Boolean, default: false }, // заменить на форсенд??
  source: { type: String, enum: SOURCE_CHOICES, default: 'telegram' },
  new_status: { type: String, enum: STATUS_CHOICES, default: 'unauthorized' },
  last_reset_date: { type: Date, default: Date.now },
  app_hash: { type: String, maxlength: 55, default: null },
  qr: { type: String, default: null },
  remote_id: { type: String, maxlength: 1000, default: null },
  remote_entity: { type: Schema.Types.Mixed, default: {} },
  remote_status: { type: String, default: 'unknown', maxlength: 1000 },
  first_name: { type: String, default: "" },
  last_name: { type: String, default: "" },
  username: { type: String, default: "" },
  about: { type: String, default: "" },
  timePeerFloodBlock: { type: String, default: "" }
};

class ChannelClass {
  static async ListWithPagination(query, options, details) {
    let { 
      page = 1,
      limit = 10,
      sortBy
    } = options;

    const projection = {
      about: 1,
      first_name: 1,
      last_name: 1,
      phone: 1,
      project: 1,
      projectTitle: 1,
      regState: 1,
      source: 1,
      timePeerFloodBlock: 1,
      username: 1,
      containerStatus: 1,
      _id: 1
    };

    console.log(sortBy);
    let { key, order } = sortBy !== undefined ? JSON.parse(sortBy) : {};
    let sortField = "_id";
    let sortOrder = "desc";
    let sortStage = { _id: -1 };  
    let operationResult = null;
    
    if (key) {
      try {
        const sortParams = {key: key ? key : "first_name", order: order ? order : "asc"};
        const allowedSortFields = [
          "phone",
          "projectTitle",
          "status",
          "source",
          "user",
          "_id"
        ];
    
        if (allowedSortFields.includes(sortParams.key)) {
          switch (sortParams.key) {
            case "status":
              sortField = "regState.techState";
              break;
            case "user":
              sortField = "first_name";
              break;
            default:
              sortField = sortParams.key;
              break;
          }
          sortOrder = sortParams.order === 'asc' ? 1 : -1;
          sortStage = { [sortField]: sortOrder };
        }
      } catch (e) {
        console.error('Sort parameter error:', e);
      }
    }
  
    switch (details) {
      case "list":
        operationResult = await Channel.find(query)
          .select(projection)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort(sortStage)
          .lean();          
        break;
      default:
        operationResult = await Channel.aggregate([
          {
            $match: query
          },
          {
            $lookup: {
              from: "projects",
              localField: "project",
              foreignField: "_id",
              as: "projectData"
            }
          },
          {
            $addFields: {
              projectTitle: { 
                $ifNull: [
                  { $arrayElemAt: ["$projectData.title", 0] },
                  null
                ] 
              },
              projectId: "$project"  
            }
          },
          { $sort: sortStage },
          { $skip: (page - 1) * limit },
          { $limit: parseInt(limit) },
          {
            $project: projection
          }
        ])
                    
      break;
    }

    const total = await Channel.countDocuments(query);
    const docs = operationResult.map(doc => {
      return {
        ...doc,
        _id: doc._id
      };
    });
        
    return {
      docs,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    };
  }
}
// Составные индексы
const schema = new Schema(schemaOptions);

schema.plugin(softDeletePlugin);
schema.loadClass(ChannelClass);
const Channel = mongoose.model('Channel', schema);
export default  Channel;