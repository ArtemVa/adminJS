export default  {
  port : process.env.PORT || 8000,
  api_token : process.env.API_TOKEN,
  service_api_key : process.env.SERVICE_API_KEY,
  open_ai : process.env.OPENAI_API_KEY,
  environmentType: process.env.ENVIRONMENT_TYPE || "develop",
  mongo : {
      opts: {
        pass: process.env.MONGO_PASS,
        user: process.env.MONGO_USER,
        dbName: process.env.MONGO_DB
      },
      uri: `mongodb://${process.env.MONGO_HOST || "127.0.0.1"}`
    },
  amqp : {
    hostname: process.env.AMQP_HOST,
    password: process.env.AMQP_PASS,
    username: process.env.AMQP_USER,
    port: process.env.AMQP_PORT || 5672,
    vhost : process.env.AMQP_VHOST || "channels"
  },
  loki: {
    host: process.env.LOKI_HOST,
    level: process.env.LOG_LEVEL || "info",
    labels: {
      app: process.env.APP_NAME || "main-server",
      env: process.env.ENVIRONMENT_TYPE,
      instance: process.env.INSTANCE_ID || 'main',
    },
  },
  autoLoginURL : process.env.AUTO_LOGIN_URL,
  newsLetter : {
    AutoStartStop : +process.env.NEWS_LETTER_AUTO_START_STOP || 180000,
    CheckSuccessStatus: +process.env.NEWS_LETTER_CHECK_SUCCESS_STATUS || 150000
  },
  fixChannels : {
    FixChannelForReg : +process.env.AUTOREGISTRATION_TIME_RESTART || 660000,
    ForRegToFalse : +process.env.FOR_REG_TO_FALSE || 6
  },
  regStats : {
    checkTime : +process.env.STATS_TIME_RESTART || 60*1000*60
  },
  replyChats : {
    checkTime : +process.env.REPLY_CHATS || 15000
  },
  checkTariff : {
    checkTime : +process.env.CHECK_TARIFF || 60*1000*60*2 
  },
  outSourcePing:{
    intervalTime: 2 * 60 * 60 * 1000
  },
  robokassa:{
    robo_merchant: process.env.ROBO_MERCHANT,
    robo_password1: process.env.ROBO_PASSWORD1,
    robo_password2: process.env.ROBO_PASSWORD2,
    robo_test_password1: process.env.ROBO_TEST_PASSWORD1,
    robo_test_password2: process.env.ROBO_TEST_PASSWORD2,
    robo_is_test: process.env.ROBO_IS_TEST
  }
};