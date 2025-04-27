/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */

const rhea = require("rhea");
const fs = require("fs");
const path = require('path');
const EventEmitter = require("events");

class Connection extends EventEmitter {
  constructor (config) {
    super();
    this.config = config;
    this.container = rhea.create_container();
    this.connectionOpenedTime = null;
    this.absoluteStartTime = Date.now();
    this.connection = null;
  }

  getConnectionOptions () {
    const options = {
      host: this.config.host,
      port: this.config.port || (this.config.tls ? 5671 : 5672),
      transport: this.config.tls ? "tls" : "tcp",
    };

    if (this.config.tls) {
      const key = fs.readFileSync(this.config.key, "utf8");
      const cert = fs.readFileSync(this.config.cert, "utf8");
      options.key = key;
      options.cert = cert;
      options.servername = this.config.servername;
      options.enable_sasl_external = true;

      if (this.config.ca) {
        const ca = fs.readFileSync(this.config.ca, "utf8");
        options.ca = ca;
      }
    } else {
      options.username = this.config.username;
      options.password = this.config.password;
    }

    return options;
  }

  connect () {
    if (this.connection) {
      return this.connection;
    }

    const connectionOptions = this.getConnectionOptions();
    /*
    console.log(
      `[Init] Connecting to ${this.config.tls ? "amqps" : "amqp"}://${this.config.host}:${connectionOptions.port} ...`
    );
    */

    this.connection = this.container.connect(connectionOptions);

    this.connection.on("connection_open", (context) => {
      this.connectionOpenedTime = Date.now() - this.absoluteStartTime;
      this.emit("connection_open", context);
    });

    this.container.on('error', (context) => {
      console.error('Connection error:', context);
    });

    return this.connection;
  }

  close () {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  getMetrics () {
    return {
      connectionOpenedTime: this.connectionOpenedTime
    };
  }
}

module.exports = Connection;
