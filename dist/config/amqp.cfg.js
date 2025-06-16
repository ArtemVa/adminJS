import cfg from "./srv.cfg.js";
export default  {
  "$schema": "../../node_modules/rascal/lib/config/schema.json",
  "vhosts": {
    [cfg.amqp.vhost]: {
      "assert": true,
      "connection": { 
        "hostname": cfg.amqp.hostname,
        "user": cfg.amqp.username,
        "password": cfg.amqp.password
      },
      "publications": {
        "events" : {
          "exchange": "events"
        }
      },
      "exchanges": {
        "events" : {
          "type": "direct"
        }
      }
    }
  }
}