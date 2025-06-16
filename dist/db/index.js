import mongoose from 'mongoose';
import { Database, Resource } from '@adminjs/mongoose';
import AdminJS from 'adminjs';

const user = process.env.DATABASE_USER;
const pass = process.env.DATABASE_PASSWORD;
const host = process.env.DATABASE_HOST || "127.0.0.1";
const dbName = process.env.DATABASE_NAME || "neurounit";

// authSource=admin — если у вас пользователь создан в базе "admin"
const uri = `mongodb://${user}:${pass}@${host}/${dbName}?authSource=admin`;

AdminJS.registerAdapter({ Database, Resource });
const initialize = async () => {
  const db = await mongoose.connect(uri,);
  return { db };
};
export default initialize;
