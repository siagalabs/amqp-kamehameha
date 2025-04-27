/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const os = require('os')
const { randomUUID } = require("crypto");
const byteSize = require("byte-size");
const fs = require('fs')
const path = require('path');
const { Statistics, Crypto } = require("./utils");
const Connection = require("./connection");
const Sender = require("./sender");
const Receiver = require("./receiver");

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option("host", { type: "string", default: 'localhost', description: "The AMQP server host address" })
  .option("port", { type: "number", description: "The AMQP server port number", default: 5672 })
  .option("username", { type: "string", description: "Username for the connection" })
  .option("password", { type: "string", description: "Password for the connection" })
  .option("address", { type: "string", description: "The queue name", demandOption: true })
  .option("count", { type: "number", description: "Number of messages to send", default: 10000 })
  .option("mode", { type: "string", description: "Mode of operation (sender, receiver, both)", choices: ["sender", "receiver", "both"], default: "both" })
  .option("payload", { type: "string", description: "File for the message body" })
  .option("tls", { alias: "s", type: "boolean", description: "Use TLS (AMQPS) connection", default: false, group: "TLS" })
  .option("key", { type: "string", description: "The client TLS private key file", group: "TLS" })
  .option("cert", { type: "string", description: "The client TLS public key file", group: "TLS" })
  .option("ca", { type: "string", description: "The CA certificate file", group: "TLS" })
  .option('servername', { type: 'string', description: 'Server name for TLS verification', group: 'TLS' })
  .option("encrypt", { type: "boolean", description: "Enable message body encryption", default: false, group: 'Message Encryption' })
  .option("encryptKey", { type: "string", description: "The recipient public key for message encryption", group: 'Message Encryption' })
  .option("decryptKey", { type: "string", description: "The recipient private key for message decryption", group: 'Message Encryption' })
  .option("sign", { type: "boolean", description: "Enable message body signing", default: false, group: 'Message Signing' })
  .option("signKey", { type: "string", description: "The sender private key for message signing.", group: 'Message Signing' })
  .option("signCert", { type: "string", description: "The sender publick key for message signing verification", group: 'Message Signing' })
  .option("output", { type: "string", description: "Output path for the results" })
  .help().argv;

async function main () {
  if (!argv.count) {
    argv.count = 10000;
  }

  if (argv.payload) {
    // Ensure the payload file exists
    if (!fs.existsSync(path.resolve(argv.payload))) {
      console.error(`Error: Payload file ${path.resolve(argv.payload)} does not exist`);
      process.exit(1);
    }
  }

  if (argv.tls) {
    if (!argv.key || !argv.cert) {
      console.error("Error: TLS key and certificate files are required when using TLS");
      process.exit(1);
    }

    // Ensure the TLS key and certificate files exist
    if (!fs.existsSync(path.resolve(argv.key))) {
      console.error(`Error: TLS key file ${path.resolve(argv.key)} does not exist`);
      process.exit(1);
    }
    if (!fs.existsSync(path.resolve(argv.cert))) {
      console.error(`Error: TLS certificate file ${path.resolve(argv.cert)} does not exist`);
      process.exit(1);
    }
    if (argv.ca && !fs.existsSync(path.resolve(argv.ca))) {
      console.error(`Error: CA certificate file ${path.resolve(argv.ca)} does not exist`);
      process.exit(1);
    }
  }

  if (argv.encrypt) {
    // Ensure the encryption key files exist
    if (argv.mode === "both" || argv.mode === "sender") {
      if (!fs.existsSync(path.resolve(argv.encryptKey))) {
        console.error(`Error: Encryption key file ${path.resolve(argv.encryptKey)} does not exist`);
        process.exit(1);
      }
    }
    if (argv.mode === "both" || argv.mode === "receiver") {
      if (!fs.existsSync(path.resolve(argv.decryptKey))) {
        console.error('Error: Decryption key file ${path.resolve(argv.decryptKey)} does not exist');
        process.exit(1);
      }
    }
  }

  if (argv.sign) {
    // Ensure the signing key files exist
    if (argv.mode === "both" || argv.mode === "sender") {
      if (!fs.existsSync(path.resolve(argv.signKey))) {
        console.error(`Error: Signing key file ${path.resolve(argv.signKey)} does not exist`);
        process.exit(1);
      }
    }
    if (argv.mode === "both" || argv.mode === "receiver") {
      if (!fs.existsSync(path.resolve(argv.signCert))) {
        console.error(`Error: Signing certificate file ${path.resolve(argv.signCert)} does not exist`);
        process.exit(1);
      }
    }
  }

  if (!argv.output) {
    argv.output = path.join(os.tmpdir(), `kame-${Date.now()}-${randomUUID()}`);
  }

  const stats = new Statistics();
  const connection = new Connection(argv);
  const crypto = new Crypto(argv);
  let sender = null;
  let receiver = null;
  let intervalId = null;

  function getMetrics () {
    const metrics = {
      connection: connection.getMetrics(),
      sender: sender?.getMetrics(),
      receiver: receiver ? receiver.getMetrics() : null,
      summary: stats.getSummaryMetrics(),
      senderSnapshots: stats.getSenderSnapshots(),
      receiverSnapshots: stats.getReceiverSnapshots()
    };
    if (argv.mode === "both" || argv.mode === "receiver") {
      const throughput = (metrics.receiver.receivedCount / metrics.receiver.duration)
      metrics.throughput = throughput
    }
    return metrics
  }

  function endTest () {
    clearInterval(intervalId);
    connection.close()
    printTableFooter()
    const metrics = getMetrics();
    printResults(metrics);
    if (argv.output) {
      saveResults(argv.output, metrics);
    }
  }

  printTableHeaders();
  intervalId = setInterval(() => {
    stats.updateSenderStats(connection.absoluteStartTime);
    stats.updateReceiverStats(connection.absoluteStartTime);
    printCombinedStats(stats.getStats());
  }, 2000);

  if (argv.mode === "both" || argv.mode === "sender") {
    sender = new Sender(connection, argv, stats, crypto);
    await sender.setup();
  }

  if (argv.mode === "both" || argv.mode === "receiver") {
    receiver = new Receiver(connection, argv, stats, crypto);
    receiver.onComplete = () => {
      endTest();
    }
    await receiver.setup();
  }

  if (argv.mode === "both" || argv.mode === "sender") {
    // Keep sending messages until the count is reached
    while (!await sender.send()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // console.log("Sender finished sending messages");
  if (!receiver) {
    console.log('Pending deliveries', sender.pendingDeliveries.size)
    await new Promise((resolve) => {
      // Wait for all messages to be sent
      const checkPending = setInterval(() => {
        if (sender.pendingDeliveries.size === 0) {
          console.log('All messages sent');
          clearInterval(checkPending);
          resolve();
        }
      }, 100);
    });
    // Close the connection
    connection.close()
    // Give a short time for the connection to close cleanly
    setTimeout(() => {
      endTest();
    }, 500);
  }
}

function printResults (metrics) {
  function padString (val, len = 50) {
    const str = String(val) || '';
    return str.length < len ? str.padEnd(len, '.') : str;
  }
  console.log(`\n--- Results ---`);

  console.log('\nConfiguration:')
  console.log(`${padString('Host:')} ${argv.host}`);
  console.log(`${padString('Port:')} ${argv.port}`);
  console.log(`${padString('TLS:')} ${argv.tls ? 'enabled' : 'disabled'}`);
  console.log(`${padString('Mode:')} ${argv.mode}`);
  console.log(`${padString('Queue:')} ${argv.address}`);
  console.log(`${padString('Message Signing:')} ${argv.sign ? 'enabled' : 'disabled'}`);
  console.log(`${padString('Message Encryption:')} ${argv.encrypt ? 'enabled' : 'disabled'}`);
  console.log(`${padString('Payload File:')} ${argv.payload}`);
  console.log(`${padString('Output File:')} ${argv.output}`);

  const payloadSize = byteSize(metrics.summary.payloadSize);
  console.log(`${padString('Body Payload Size:')} ${payloadSize.value} ${payloadSize.unit} `);

  const connectionOpenedTime = metrics.connection.connectionOpenedTime;
  console.log(`${padString('\nConnection opened:')} ${connectionOpenedTime} ms`);

  if (argv.mode === "both" || argv.mode === "sender") {
    console.log(`\nSender: `);
    console.log(`${padString('Sender ready:')} ${metrics.sender.senderReadyTime} ms`);
    console.log(`${padString('Sent:')} ${metrics.sender.sentCount} `);
    console.log(`${padString('Rate:')} ${metrics.sender.sentRate.toFixed(0)} msg / sec`);
    console.log(`${padString('Per Message Size:')} ${metrics.sender.perMessageSize} bytes`);
  }

  if (argv.mode === "both" || argv.mode === "receiver") {
    console.log(`\nReceiver: `);
    console.log(`${padString('Receiver ready:')} ${metrics.receiver.receiverReadyTime} ms`);
    console.log(`${padString('Received:')} ${metrics.receiver.receivedCount} `);
    console.log(`${padString('Duration:')} ${metrics.receiver.duration.toFixed(2)} seconds`);
    console.log(`${padString('Per Message Size:')} ${metrics.receiver.perMessageSize} bytes`);
    const throughput = (metrics.throughput).toFixed(2)
    console.log(`${padString('Throughput:')} ${throughput} msg / sec`);

    console.log(`\nLatency Statistics: `);
    console.log(`${padString('Average:')} ${metrics.summary.latency.avg.toFixed(2)} ms`);
    console.log(`${padString('Min:')} ${metrics.summary.latency.min} ms`);
    console.log(`${padString('Max:')} ${metrics.summary.latency.max} ms`);
    console.log(`${padString('95th percentile:')} ${metrics.summary.latency.p95} ms`);
  }
}

function saveResults (pathname, metrics) {
  // Create the directory if it doesn't exist
  fs.mkdirSync(path.resolve(pathname), { recursive: true });

  // Save sender snapshots as csv
  const senderSnapShotFile = path.join(pathname, 'sender_snapshots.csv');
  const senderData = metrics.senderSnapshots.map(snapshot => {
    return `${snapshot.timestamp},${snapshot.sent},${snapshot.rate}\n`;
  });
  fs.writeFileSync(senderSnapShotFile, 'timestamp,sent,rate\n' + senderData.join(''));

  // Save receiver snapshots as csv
  const receiverSnapShotFile = path.join(pathname, 'receiver_snapshots.csv');
  const receiverData = metrics.receiverSnapshots.map(snapshot => {
    return `${snapshot.timestamp},${snapshot.received},${snapshot.rate},${snapshot.avgLatency}\n`;
  });

  fs.writeFileSync(receiverSnapShotFile, 'timestamp,received,rate,avg_latency\n' + receiverData.join(''));

  // Save summary metrics as JSON
  const summaryMetricsFile = path.join(pathname, 'summary_metrics.json');
  fs.writeFileSync(summaryMetricsFile, JSON.stringify(metrics.summary, null, 2));

  // Save full metrics as JSON
  const fullMetricsFile = path.join(pathname, 'full_metrics.json');
  fs.writeFileSync(fullMetricsFile, JSON.stringify(metrics, null, 2));

  console.log(`\nResults saved to ${pathname}`);
}

function printTableHeaders () {
  console.log("\n");
  if (argv.mode === "both") {
    console.log("+--------+-------------+---------------+--------+-------------+---------------+-------------+");
    console.log("|            SENDER                    |                        RECEIVER                    |");
    console.log("+--------+-------------+---------------+--------+-------------+---------------+-------------+");
    console.log("| Time[s]| Message Cnt | Rate (m/s)    | Time(s)| Message Cnt | Rate (m/s)    |  Latency(ms)|");
    console.log("+--------+-------------+---------------+--------+-------------+---------------+-------------+");
  } else if (argv.mode === "sender") {
    console.log("+--------+-------------+---------------+");
    console.log("|            SENDER                    |");
    console.log("+--------+-------------+---------------+");
    console.log("| Time[s]| Message Cnt | Rate (m/s)    |");
    console.log("+--------+-------------+---------------+");
  } else if (argv.mode === "receiver") {
    console.log("+--------+-------------+---------------+-------------+");
    console.log("|                        RECEIVER                    |");
    console.log("+--------+-------------+---------------+-------------+");
    console.log("| Time(s)| Message Cnt | Rate (m/s)    |  Latency(ms)|");
    console.log("+--------+-------------+---------------+-------------+");
  }
}

function printTableFooter () {
  if (argv.mode === "both") {
    console.log("+--------+-------------+---------------+--------+-------------+---------------+-------------+");
  } else if (argv.mode === "sender") {
    console.log("+--------+-------------+---------------+");
  }
  else if (argv.mode === "receiver") {
    console.log("+--------+-------------+---------------+-------------+");
  }
}

function printCombinedStats (stats) {
  const s = stats.sender;
  const r = stats.receiver;

  // Format values
  const sTimeStr = s.time.toFixed(1).padStart(6);
  const sCountStr = s.snapShotCount.toString().padStart(11);
  const sRateStr = s.snapShotRate.toFixed(0).padStart(13);
  const rTimeStr = r.time.toFixed(1).padStart(6);
  const rCountStr = r.count.toString().padStart(11);
  const rRateStr = r.rate.toFixed(0).padStart(13);
  const latencyStr = r.avgLatency.toFixed(2).padStart(11);

  if (argv.mode === "both") {
    console.log(`| ${sTimeStr} | ${sCountStr} | ${sRateStr} | ${rTimeStr} | ${rCountStr} | ${rRateStr} | ${latencyStr} | `);
  } else if (argv.mode === "sender") {
    console.log(`| ${sTimeStr} | ${sCountStr} | ${sRateStr} | `);
  }
  else if (argv.mode === "receiver") {
    console.log(`| ${rTimeStr} | ${rCountStr} | ${rRateStr} | ${latencyStr} | `);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
})