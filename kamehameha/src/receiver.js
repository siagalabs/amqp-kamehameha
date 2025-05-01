/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */
const rhea = require("rhea");

class Receiver {
  constructor (connection, config, stats, crypto) {
    this.connection = connection;
    this.config = config;
    this.stats = stats;
    this.crypto = crypto;
    this.receivedCount = 0;
    this.startTime = null;
    this.receiverReadyTime = null;
    this.messageSize = 0;
    this.counter = 0;
  }

  async setup () {
    const conn = await this.connection.connect();
    return new Promise((resolve) => {
      conn.on("receiver_open", (context) => {
        this.receiverReadyTime = Date.now() - this.connection.absoluteStartTime;
        resolve(this);
      });

      conn.on("message", (context) => this.handleMessage(context));
      conn.open_receiver(this.config.address);
    });
  }

  handleMessage (context) {
    if (!this.startTime) {
      this.startTime = Date.now();
    }

    this.counter++;
    // console.log(`Received message #${this.counter}`);
    const receiveTimestamp = Date.now();
    const sentTimestamp = context.message.application_properties?.sent_time;

    if (!this.messageSize) {
      const rawMessage = context.message;
      const encoded = rhea.message.encode(rawMessage);
      const messageSize = encoded.length;
      this.messageSize = messageSize;
      // console.log(`Received message size: ${messageSize} bytes`);
    }

    if (sentTimestamp) {
      this.stats.latencies.push(receiveTimestamp - sentTimestamp);
    }

    let decryptedMessage = context.message.body;
    if (this.config.encrypt) {
      const decryptStartTime = Date.now();
      decryptedMessage = this.crypto.decryptMessage(context.message);
      const decryptDuration = Date.now() - decryptStartTime;
      this.stats.decryptionTimes.push(decryptDuration);
    }

    // const messageSignature = context.message.annotations?.['x-digital-signature'];
    const messageSignature = context.message.application_properties?.['x-digital-signature'];
    if (messageSignature && this.config.signCert) {
      const verifyStartTime = Date.now();
      const isValid = this.crypto.verifySignature(decryptedMessage, messageSignature);
      if (!isValid) {
        console.error("Invalid signature for message:", context.message);
      }
      const verifyDuration = Date.now() - verifyStartTime;
      this.stats.signatureTimes.push(verifyDuration);
    }

    this.receivedCount++;
    this.stats.snapShotReceivedCount++;

    // console.log(`Received message #${this.receivedCount}: ${this.config.count} expected`);
    if (this.receivedCount === this.config.count) {
      this.onComplete();
    }
  }

  onComplete () {
    // This method can be overridden by the main application
    // to handle completion of receiving all messages
  }

  getMetrics () {
    return {
      receivedCount: this.receivedCount,
      receiverReadyTime: this.receiverReadyTime,
      perMessageSize: this.messageSize,
      duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0
    };
  }
}

module.exports = Receiver;
