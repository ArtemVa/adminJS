import mongoose from 'mongoose';
import { Database, Resource } from '@adminjs/mongoose';
import AdminJS from 'adminjs';

const opts = {
  pass: process.env.DATABASE_PASSWORD,
  user: process.env.DATABASE_USER,
  dbName: process.env.DATABASE_NAME || "test"
};

const uri = `mongodb://${process.env.DATABASE_HOST || "127.0.0.1"}`;

AdminJS.registerAdapter({ Database, Resource });
const initialize = async () => {
  const db = await mongoose.connect(uri, opts);
  return { db };
};
export default initialize;
