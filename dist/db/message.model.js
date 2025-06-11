import mongoose from 'mongoose';
const Schema = mongoose.Schema;

// Схема профиля контакта
const schemaOptions = {
	from: {
		type: String,
		required: true,
	},
	to: {
		type: String,
		required: true,
	},
	sent : {
		type: Date,
	},
	serviceType : {
		type: String,
	},
	fromMe: {
		type: Boolean,
		required: true,
	},
	valuable : {
		type: Boolean,
	},
	content: {
		type: String,
		required: true,
	},
	hash: {
		type: String,
		required: true,
	},
	contentType: {
		type: String,
		default : "text"
	},
	type: {
		type: String,
	},
	originalHash: {
		type: String,
	},
	wakey: {
		type: String,
	},
	created: {
		type: Date,
	},
	client: {
		type: Schema.Types.ObjectId,
		ref: "Client",
	},
	group: {
		type: String,
		ref: "Group",
	},
	company: {
		type: Schema.Types.ObjectId,
		ref: "Company",
	},
	channel: {
		type: Schema.Types.ObjectId,
		ref: "Channel",
	},
	chat: {
        type: Schema.Types.ObjectId,
        ref: "Chat",
        index: true
    },
	status: {
		type: String,
		required: true,
		default: "Created",
	},
	newsletter: {
		type: Schema.Types.ObjectId,
		ref: "Newsletter",
	},
	confirmed : {
		type: Boolean,
		default: false
	},
	values : {
		type: [String],
		default: undefined
	},
	media : {
		type: String
	}
}

// Составные индексы
const schema = new Schema(schemaOptions);
const Message = mongoose.model("Message", schema);
export default  Message;