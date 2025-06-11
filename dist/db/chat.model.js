import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Схема профиля контакта
const contactProfileSchema = new Schema({
  fullName: {
    type: String
  },
  role: {
    type: String
  },
  about: {
    type: String
  },
  avatar: {
    type: String
  }
}, { _id: false });

const chatSchema = new Schema({
  // Внешний идентификатор чата
  externalId: {
    type: String,
    index: true
  },
  
  // Связи с участниками чата
  client: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    index: true
  },

  project: { 
    type: Schema.Types.ObjectId, 
    ref: 'Project', 
    default: null 
  },

  channel: {
    type: Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true
  },
  
  company: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  
  // Последнее сообщение в чате
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // Время последней активности
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  messageLimit: {
    current: {
      type: Number,
      default: 0
    },
    lastReset: {
      type: Date,
      default: () => new Date()
    }
  },
  
  // Профиль контакта
  contactProfile: {
    type: contactProfileSchema,
    default: {}
  },
  // флаг ответа на новые сообщения
  canReply: {
    type: Boolean,
    default: true
  },
  // Статус чата
  status: {
    type: String,
    enum: ['new', 'closed', 'success', 'contact_received', 'interest_shown', 'user_doesnt_exist', 'error', 'deleted'],
    default: 'new',
    index: true
  },
  
  // Флаг активности бота
  is_auto_active: {
    type: Boolean,
    default: true
  },
  // Дата создания
  created: {
    type: Date,
    default: Date.now
  },

  leadId: {
    type: String,
    default: ''
  },
});

// Составные индексы
chatSchema.index({ channel: 1, client: 1 });
chatSchema.index({ company: 1, lastActivity: -1 });


const Chat = mongoose.model('Chat', chatSchema);
export default Chat;