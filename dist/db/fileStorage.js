import mongoose from 'mongoose';
const { Schema } = mongoose;

const fileStorageSchema = new Schema({
  file_name: { type: String, required: true },
  file_path: { type: String, required: true },
  file_data: { type: Buffer, required: true },
  file_extension: { type: String, required: true },
  file_text: { type: String, default: '' },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  link: { type: String },
  created_at: { type: Date, default: Date.now },
});

const FileStorage = mongoose.model('FileStorage', fileStorageSchema);
export default FileStorage;