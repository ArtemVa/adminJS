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
            "events" : {
              "options": {
                "durable": true,
                "maxPriority": 10
              }
            },
            "gpt-service" : {
              "options": {
                "durable": true,
                "maxPriority": 10
              }
            },
            "errors": {
              "options":{
                "durable": true,
                "maxPriority": 10
              }
            },
            "participants-events": {
              "options":{
                "durable": true,
                "maxPriority": 10
              }
            }
          }, 
          "publications": {
            "errors" : {
              "exchange": "errors",
              "routingKey" : "errors"
            },
            "gpt-service" : {
              "exchange": "gpt-service",
              "routingKey" : "gpt-service"
            },
            "participants-events" : {
              "exchange": "participants-events",
              "routingKey" : "participants-events"
            }
          },
          "subscriptions": {
            "events" : {
              "queue": "events",
              "prefetch": 20
            },
            "gpt-service" : {
              "queue": "gpt-service",
              "prefetch": 1
            },
            "errors": {
              "queue": "errors",
              "prefetch": 20
            },
            "participants-events": {
              "queue": "participants-events",
              "prefetch": 1
            }
          },
          "exchanges": {
            "events" : {
              "type": "direct"
            },
            "gpt-service" : {
              "type": "direct"
            },
            "errors": {
              "type": "direct"
            },
            "participants-events": {
              "type": "direct"
            }
          },
          "bindings": {
            "b_channels": {
              "source": "events",
              "destination": "events",
              "bindingKeys": ["events"]
            },
            "b_gpt": {
              "source": "gpt-service",
              "destination": "gpt-service",
              "bindingKeys": ["gpt-service"]
            },
            "b_errors": {
              "source": "errors",
              "destination": "errors",
              "bindingKeys": ["errors"]
            },
            "b_participants-events": {
              "source": "participants-events",
              "destination": "participants-events",
              "bindingKeys": ["participants-events"]
            }
          }
        }
      }
    }