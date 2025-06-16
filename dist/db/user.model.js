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
  company : {
    type : Schema.Types.ObjectId,
    ref: 'Company',
    require : true
  },
  is_active : {
    type : Boolean,
    default : true
  },
  referralLink: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReferralLinks',
  },
  origin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  created: {
    type: Date,
    default: () => {
      const date = moment_tz.tz("Europe/Moscow");
      return date.toDate();
    },
  },
};

class UserClass {
  static async ListWithPagination(options) {
      const { 
          page = 1,
          limit = 10,
          detail = false,
          sortBy
      } = options;
  
      let sortField = "_id";
      let sortOrder = "desc";
      let sortStage = { _id: -1 };
      const projection = {
        login: 1,
        email: 1,
        phone: 1,
        is_active: 1,
        firstName: 1,
        lastName: 1
      };

      if (sortBy) {
          try {
            const sortParams = typeof sortBy === 'string' ? JSON.parse(sortBy) : sortBy;
            const allowedSortFields = [
                '_id',
                'login',
                'email',
                'phone',
                'is_active',
                'firstName',
                'lastName'
            ];
  
            if (allowedSortFields.includes(sortParams.key)) {
              switch (sortParams.key) {
                case "user":
                  sortField = "firstName";
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
  
      const operationResult = await User.find()
        .populate({
          path: 'company',
          select: 'name currentTariff',
          populate: {
            path: 'currentTariff',
            select: 'name'
          }
        })
        .select(projection)
        .skip((page - 1) * limit)
          .limit(limit)
          .sort(sortStage)
          .lean();   
      return operationResult
    }
}

const schema = new Schema(schemaOptions)
schema.loadClass(UserClass);
const User = mongoose.model('User', schema);
export default User