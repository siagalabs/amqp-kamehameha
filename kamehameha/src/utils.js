/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class Statistics {
  constructor () {
    this.sentCount = 0;
    this.snapShotSentCount = 0;
    this.snapShotReceivedCount = 0;
    this.senderSnapshots = [];
    this.receiverSnapshots = [];
    this.latencies = [];
    this.signatureTimes = [];
    this.decryptionTimes = [];
    this.payloadSize = 0;
    this.statistics = {
      sender: { time: 0, snapShotCount: 0, snapShotRate: 0, count: 0, rate: 0 },
      receiver: { time: 0, count: 0, rate: 0, cpuUsage: 0, avgLatency: 0 }
    };
  }

  updateSenderStats (absoluteStartTime) {
    const time = Date.now()
    this.statistics.sender.time = (time - absoluteStartTime) / 1000;
    this.statistics.sender.snapShotCount = this.snapShotSentCount;
    this.statistics.sender.snapShotRate = this.snapShotSentCount / this.statistics.sender.time;
    this.statistics.sender.count = this.sentCount;
    this.statistics.sender.rate = this.sentCount / this.statistics.sender.time;
    const snapshot = { timestamp: time, sent: this.snapShotSentCount, rate: this.statistics.sender.snapShotRate }
    this.senderSnapshots.push(snapshot);
    this.snapShotSentCount = 0;
  }

  updateReceiverStats (absoluteStartTime) {
    const time = Date.now();
    this.statistics.receiver.time = (time - absoluteStartTime) / 1000;
    this.statistics.receiver.count = this.snapShotReceivedCount;
    this.statistics.receiver.rate = this.snapShotReceivedCount / this.statistics.receiver.time;
    const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length || 0;
    this.statistics.receiver.avgLatency = avgLatency;
    const snapshot = { timestamp: time, received: this.snapShotReceivedCount, rate: this.statistics.receiver.rate, avgLatency: avgLatency }
    this.receiverSnapshots.push(snapshot);
    this.snapShotReceivedCount = 0;
  }

  getStats () {
    return this.statistics;
  }

  percentile (arr, p) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[idx];
  }

  getSenderSnapshots () {
    return this.senderSnapshots;
  }

  getReceiverSnapshots () {
    return this.receiverSnapshots;
  }

  getSummaryMetrics () {
    const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length || 0;
    const maxLatency = Math.max(...this.latencies) || 0;
    const minLatency = Math.min(...this.latencies) || 0;
    const p95 = this.percentile(this.latencies, 95);

    return {
      payloadSize: this.payloadSize,
      latency: {
        avg: avgLatency,
        min: minLatency,
        max: maxLatency,
        p95: p95
      },
      signature: {
        max: Math.max(...this.signatureTimes) || 0,
        min: Math.min(...this.signatureTimes) || 0,
        avg: this.signatureTimes.reduce((a, b) => a + b, 0) / this.signatureTimes.length || 0
      },
      decryption: {
        max: Math.max(...this.decryptionTimes) || 0,
        min: Math.min(...this.decryptionTimes) || 0,
        avg: this.decryptionTimes.reduce((a, b) => a + b, 0) / this.decryptionTimes.length || 0
      }
    };
  }
}

class Crypto {
  constructor (config) {
    this.config = config;
    if (config.sign && config.signKey) {
      this.signingKey = fs.readFileSync(path.resolve(config.signKey), 'utf8');
    }
    if (config.sign && config.signCert) {
      this.signingCert = fs.readFileSync(path.resolve(config.signCert), 'utf8');
    }
    if (config.encrypt && config.encryptKey) {
      this.encryptionKey = fs.readFileSync(path.resolve(config.encryptKey), 'utf8');
    }
    if (config.encrypt && config.decryptKey) {
      this.decryptionKey = fs.readFileSync(path.resolve(config.decryptKey), 'utf8');
    }
  }

  verifySignature (messageBody, signature) {
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(messageBody);
    verify.end();
    return verify.verify(this.signingCert, signature, "base64");
  }

  signMessage (message) {
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(message);
    sign.end();
    return sign.sign(this.signingKey, "base64");
  }

  aesEncrypt (data, key, iv) {
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  }

  encryptMessage (message) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    const encryptedData = this.aesEncrypt(message, aesKey, iv);
    const encryptedKey = crypto.publicEncrypt(
      {
        key: this.encryptionKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      aesKey
    );

    return {
      encryptedKey: encryptedKey.toString("base64"),
      iv: iv.toString("base64"),
      encryptedMessage: encryptedData
    };
  }

  decryptMessage (message) {
    // console.log('to decrypt:', message);
    /*
    // Check if message and message_annotations exist
    if (!message || !message.message_annotations) {
      console.warn('Invalid message: message_annotations not found. Test result might be incorrect. Please ensure the queue is empty before running the test.');
      return message.body;
    }

    // Check if required encryption fields exist
    if (!message.message_annotations['x-encrypted-key'] || !message.message_annotations['x-iv'] || !message.body) {
      console.warn('Invalid message: missing encryption fields (x-encrypted-key, x-iv or body). Test result might be incorrect. Please ensure the queue is empty before running the test.');
      return message.body;
    }
    const encryptedKey = Buffer.from(message.message_annotations['x-encrypted-key'], 'base64');
    const iv = Buffer.from(message.message_annotations['x-iv'], 'base64');
    */
    // Check if message and message_annotations exist
    if (!message || !message.application_properties) {
      console.warn('Invalid message: application_properties not found. Test result might be incorrect. Please ensure the queue is empty before running the test.');
      return message.body;
    }

    // Check if required encryption fields exist
    if (!message.application_properties['x-encrypted-key'] || !message.application_properties['x-iv'] || !message.body) {
      console.warn('Invalid message: missing encryption fields (x-encrypted-key, x-iv or body). Test result might be incorrect. Please ensure the queue is empty before running the test.');
      return message.body;
    }
    const encryptedKey = Buffer.from(message.application_properties['x-encrypted-key'], 'base64');
    const iv = Buffer.from(message.application_properties['x-iv'], 'base64');

    const encryptedData = Buffer.from(message.body, 'base64');

    const aesKey = crypto.privateDecrypt(
      {
        key: this.decryptionKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      encryptedKey
    );

    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]).toString('utf8');
  }
}

module.exports = { Statistics, Crypto };
