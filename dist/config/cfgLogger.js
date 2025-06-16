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
      "queues": {
        "logexp-main" : {
          "options": {
            "durable": true,
            "maxPriority": 10
          }
        },
      }, 
      "publications": {
        "logexp-main" : {
          "exchange": "logexp-main"
        }
      },
      "exchanges": {
        "logexp-main" : {
          "type": "direct"
        }
      },
      "bindings": {
        "b_logger_main": {
            "source": "logexp-main",
            "destination": "logexp-main",
            "bindingKeys": ["logexp-main"]
          },
      }
    }
  }
}