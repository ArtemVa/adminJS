import variableExpansion from 'dotenv-expand';
import dotenv from 'dotenv';
const srvEnv = dotenv.config();
const env = process.env.NODE_ENV ? process.env.NODE_ENV : "dev";
const sharedEnv = dotenv.config({path: `.env-${env}-api`});
variableExpansion.expand(srvEnv);
variableExpansion.expand(sharedEnv);