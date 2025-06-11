import mongoose from 'mongoose';
import moment_tz from 'moment-timezone';

const Schema = mongoose.Schema;

const AGENT_TYPES = {
  sales_manager: "Менеджер по продажам",
  consultant: "Консультант",
  support_manager: "Менеджер поддержки",
  review_manager: "Менеджер по работе с отзывами",
  info_business_manager: "Менеджер для инфобиза",
  services_manager: "Менеджер в сфере услуг",
  health_fitness_manager: "Менеджер в сфере здоровья и фитнеса",
};

const STATUS_CHOICES = {
  new: "Новый",
  active: "В работе",
  completed: "Завершен",
  paused: "Пауза",
  noChannels: "Нет каналов"
};

const WORK_OPTIONS = {
  1: "Входящие",
  2: "Входящие и исходящие",
};

const GPT_VERSIONS = {
  1: "OpenAI GPT-4o",
  2: "OpenAI GPT-4o mini",
};

const CRM_TYPES = {
  null: "не выбрано",
  amo_crm: "Amo Crm",
  bitrix: "Bitrix 24",
};

const softDeletePlugin = (schema) => {
  schema.add({
    deletedAt: { type: Date, default: null },
    restored_at: { type: Date, default: null },
  });

  schema.pre(/^find/, function (next) {
    if (!("deletedAt" in this.getQuery())) {
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
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  companyId: {type: Schema.Types.ObjectId, ref: "Company"},
  title: { type: String, required: true, maxlength: 1000 },
  agent_type: {
    type: String,
    enum: Object.keys(AGENT_TYPES),
    default: "sales_manager",
  },
  status: {
    type: String,
    enum: Object.keys(STATUS_CHOICES),
    default: "new",
  },
  is_active: { type: Boolean, default: false },
  work_option: {
    type: Number,
    enum: Object.keys(WORK_OPTIONS).map(Number),
    default: 1,
  },
  gpt_version: {
    type: Number,
    enum: Object.keys(GPT_VERSIONS).map(Number),
    default: 1,
  },
  hello_text: { type: String },
  prompt: { type: String, required: true },
  knowledge_base_text: { type: String },
  google_doc: { type: String },
  per_conversation_limit: { type: Number, default: 50, min: 0 },
  outgoing_limit: { type: Number, default: 30, min: 0 },
  integrations: {
    type: String,
    enum: Object.keys(CRM_TYPES),
    default: "null",
  },
  time_start: {
    type: String,
    default: "08:00",
    validate: {
      validator: (v) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      message: "Неверный формат времени (ожидается HH:MM)",
    },
  },
  time_end: {
    type: String,
    default: "22:00",
    validate: {
      validator: (v) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      message: "Неверный формат времени (ожидается HH:MM)",
    },
  },
  settings: {
    statuses: {
      isActive: { type: Boolean, default: true },
      items: {
        completed: { type: String, default: 'Клиент согласится на встречу' },
        interestShown: { type: String, default: 'Проявлен интерес к твоему предложению' },
        contactReceived: { type: String, default: 'Ты получил номер телефона клиента' },
        closed: { type: String, default: 'Помечай диалог когда клиент отказался от предложения' },
      },
    },
    integrations: {
      isActive: { type: Boolean, default: false },
      integrate: {
        type: mongoose.Schema.Types.Mixed, // enum ['amo_crm', 'bitrix', null]
        default: null,
      },
    },
    funnels: {
      isActive: { type: Boolean, default: false },
      items: {
        completed: { type: mongoose.Schema.Types.Mixed, default: '' }, // Поддержка Number | String
        closed: { type: mongoose.Schema.Types.Mixed, default: '' },    // Поддержка Number | String
        interestShown: { type: mongoose.Schema.Types.Mixed, default: '' }, // Поддержка Number | String
        contactReceived: { type: mongoose.Schema.Types.Mixed, default: '' }, // Поддержка Number | String
      },
    },
  },
  updated_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now },
  chat: [{ type: Schema.Types.ObjectId, ref: "Message" }],
  crmpipelines: [{ type: Schema.Types.ObjectId, ref: "CrmPipeline" }],
  file_storage: [{ type: Schema.Types.ObjectId, ref: "FileStorage" }],
};


const schema = new Schema(schemaOptions);

schema.plugin(softDeletePlugin);

schema.virtual("agent_type_description").get(function () {
  return AGENT_TYPES[this.agent_type];
});

schema.virtual("status_description").get(function () {
  return STATUS_CHOICES[this.status];
});

schema.virtual("work_option_description").get(function () {
  return WORK_OPTIONS[this.work_option];
});

schema.virtual("gpt_version_description").get(function () {
  return GPT_VERSIONS[this.gpt_version];
});

schema.virtual("integrations_description").get(function () {
  return CRM_TYPES[this.integrations];
});

schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });

schema.index({ userId: 1, status: 1 });
schema.index({ updated_at: -1 });

const Project = mongoose.model("Project", schema);

export default Project;