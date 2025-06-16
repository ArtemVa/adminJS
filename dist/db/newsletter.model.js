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

class NewsletterClass {
  static async ListWithPagination(query, options) {
    const { 
        page = 1,
        limit = 10,
        detail = false,
        sortBy
    } = options;

    let sortField = "_id";
    let sortOrder = "desc";

    if (sortBy) {
        try {
          const sortParams = typeof sortBy === 'string' ? JSON.parse(sortBy) : sortBy;
          const allowedSortFields = [
              'title',
              'sent_all', 
              'all_chats',
              'projectTitle',
              'dateFrom',
              'status',
              '_id',
              'sent_messages'
          ];

          if (allowedSortFields.includes(sortParams.key)) {
            sortField = sortParams.key === 'sent_all' ? 'sent_messages' : sortParams.key;
            sortOrder = sortParams.order === 'asc' ? 'asc' : 'desc';
          }
        } catch (e) {
            console.error('Sort parameter error:', e);
        }
    }

    const projection = {
        status: 1,
        type: 1,
        created: 1,
        desc: 1,
        title: 1,
        projectId: 1,
        projectTitle: 1,
        company: 1,
        timeFrom: 1,
        timeTo: 1,
        dateFrom: 1,
        dateTo: 1,
        clients: 1,
        text: {
            $concat: [
                { $substrCP: [ "$text", 0, 30 ] },
                "..."
            ]
        }
    };

    const queryOptions = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { [sortField]: sortOrder === 'desc' ? -1 : 1 }
    };

    const skipStatuses = ["Canceled"];
    const docs = await Newsletter.find(
        { status: { $nin: skipStatuses }, ...query },
        projection,
        queryOptions
    ).populate("company", "title").populate("projectId");

    const docsWithStats = await Promise.all(docs.map(async doc => {
        // Всего доставлено
        const sent_messages = await NewsletterItem.countDocuments({
            newsletter: doc._id,
            status: "Delivered" 
        });
        // Всего на отправку на всю рассылку
        const all_chats = await NewsletterItem.countDocuments({
            newsletter: doc._id,
            status: { $nin: ["Registered"] }
        });

        const no_user = await NewsletterItem.countDocuments({newsletter: doc._id, status: "no_user"});
        const entity_not_found = await NewsletterItem.countDocuments({newsletter: doc._id, status: "entity_not_found"});
        const access_forbidden = await NewsletterItem.countDocuments({newsletter: doc._id, status: "access_forbidden"});
        const tech_error = await NewsletterItem.countDocuments({newsletter: doc._id, status: "Error"});
        if (!doc.projectId && doc.status !== 'Finished') {
          doc.status = NEWSLETTER_STATUS.Canceled;
        }

        const plainDoc = doc.toObject();
        return {
            title: plainDoc.title,
            projectTitle: plainDoc.projectTitle,
            projectId: plainDoc.projectId?._id,
            created: plainDoc.created,
            status: plainDoc.status,
            _id: plainDoc._id,
            timeTo: plainDoc.timeTo,
            timeFrom: plainDoc.timeFrom,
            stats: { sent_messages, all_chats, no_user, entity_not_found, access_forbidden, tech_error }
        };
    }));

    if (['sent_messages', 'all_chats', 'status'].includes(sortField)) {
      docsWithStats.sort((a, b) => {
        if (['sent_messages', 'all_chats'].includes(sortField)) {
          const aValue = a.stats[sortField];
          const bValue = b.stats[sortField];
          return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
        }
        
        if (sortField === 'status') {
            const aValue = a.status;
            const bValue = b.status;
            return sortOrder === 'desc' 
              ? bValue.localeCompare(aValue) 
              : aValue.localeCompare(bValue);
        }
      });
    }

    const total = await Newsletter.countDocuments({
        status: { $nin: skipStatuses },
        ...query
    });

    return {
        docs: docsWithStats,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
    };
  }
}

const schema = new Schema(schemaOptions)
schema.loadClass(NewsletterClass);
const Newsletter = mongoose.model('Newsletter', schema);
const NewsletterItem = mongoose.model('NewsletterItem', new Schema(newsletter_item_schema));
const NewsletterStat = mongoose.model('NewsletterStat', new Schema(newsletter_stat_schema));
export default  Newsletter;