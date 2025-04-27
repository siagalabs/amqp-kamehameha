/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const rhea = require('rhea');

class Sender extends EventEmitter {
  constructor (connection, config, stats, crypto) {
    super();
    this.connection = connection;
    this.config = config;
    this.stats = stats;
    this.crypto = crypto;
    this.sender = null;
    this.sentCount = 0;
    this.startTime = null;
    this.senderReadyTime = null;
    this.messageSize = 0;
    this.pendingDeliveries = new Set()

    // Load payload if specified
    this.payloadBody = "Hello world";
    if (config.payload) {
      const payloadPath = path.resolve(config.payload);
      if (fs.existsSync(payloadPath)) {
        this.payloadBody = fs.readFileSync(payloadPath, "utf8");
        this.stats.payloadSize = Buffer.byteLength(this.payloadBody, 'utf8');
      }
    } else {
      this.stats.payloadSize = Buffer.byteLength(this.payloadBody, 'utf8');
    }
  }

  setup () {
    return new Promise((resolve) => {
      const conn = this.connection.connect();
      const sender = conn.open_sender(this.config.address);
      sender.on('accepted', (context) => {
        this.pendingDeliveries.delete(context.delivery);
        /*
        if (this.pendingDeliveries.size === 0) {
          this.stats.updateSenderStats(this.connection.absoluteStartTime);
        }
        */
      })

      sender.on('rejected', (context) => {
        this.pendingDeliveries.delete(context.delivery);
        /*
        if (this.pendingDeliveries.size === 0) {
          this.stats.updateSenderStats(this.connection.absoluteStartTime);
        }
        */
      })

      sender.on('released', (context) => {
        this.pendingDeliveries.delete(context.delivery);
        /*
        if (this.pendingDeliveries.size === 0) {
          this.stats.updateSenderStats(this.connection.absoluteStartTime);
        }
        */
      })

      conn.on("sendable", (context) => {
        this.sender = context.sender;
        this.senderReadyTime = Date.now() - this.connection.absoluteStartTime;
        resolve(this);
      });
    });
  }

  createMessage () {
    const msg = {
      body: this.payloadBody,
      application_properties: {
        sent_time: Date.now(),
      }
    };

    const annotations = {};

    // Handle signing if enabled
    if (this.config.sign) {
      const signature = this.crypto.signMessage(this.payloadBody);
      annotations['x-digital-signature'] = signature;
    }

    // Handle encryption if enabled
    if (this.config.encrypt) {
      const result = this.crypto.encryptMessage(this.payloadBody);
      msg.body = result.encryptedMessage;
      annotations['x-encrypted-key'] = result.encryptedKey;
      annotations['x-iv'] = result.iv;
    }

    if (Object.keys(annotations).length > 0) {
      msg.message_annotations = annotations;
    }

    return msg;
  }

  async send () {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    while (this.sentCount < this.config.count && this.sender.sendable()) {
      const msg = this.createMessage();
      if (!this.messageSize) {
        const encoded = rhea.message.encode(msg);
        const messageSize = encoded.length;
        this.messageSize = messageSize;
      }
      const delivery = this.sender.send(msg);
      this.pendingDeliveries.add(delivery);
      this.sentCount++;
      this.stats.snapShotSentCount++;
      this.stats.sentCount = this.sentCount;
      // console.log(`Sent message #${this.sentCount}: ${this.config.count} expected`);
    }
    return this.sentCount >= this.config.count;
  }

  getMetrics () {
    return {
      sentCount: this.sentCount,
      perMessageSize: this.messageSize,
      sentRate: this.sentCount / ((Date.now() - this.startTime) / 1000),
      senderReadyTime: this.senderReadyTime,
      duration: (Date.now() - this.startTime) / 1000
    };
  }
}

module.exports = Sender;
