const yargs = require('yargs/yargs');
const { Statistics, Crypto } = require('./utils');
const Connection = require('./connection');
const Sender = require('./sender');
const Receiver = require('./receiver');

class Scenario {
  constructor (name, args) {
    this.name = name;
    this.args = args;
    this.stats = new Statistics();
    this.parsedArgs = this.parseArgs(args);
    this.connection = new Connection(this.parsedArgs);
    this.crypto = new Crypto(this.parsedArgs);
    this.sender = null;
    this.receiver = null;
  }

  parseArgs (args) {
    return yargs()
      .parserConfiguration({
        'camel-case-expansion': false,
        'strip-dashed': true,
        'strip-aliased': true
      })
      .parse(args);
  }

  async setup () {
    this.sender = new Sender(this.connection, this.parsedArgs, this.stats, this.crypto);
    this.receiver = new Receiver(this.connection, this.parsedArgs, this.stats, this.crypto);

    await Promise.all([
      this.sender.setup(),
      this.receiver.setup()
    ]);
  }

  async waitForConnection () {
    return new Promise((resolve) => {
      this.connection.once("connection_open", () => {
        resolve();
      });
    });
  }

  async run () {
    while (!await this.sender.send()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  getMetrics () {
    return {
      connection: this.connection.getMetrics(),
      sender: this.sender.getMetrics(),
      receiver: this.receiver.getMetrics(),
      summary: this.stats.getSummaryMetrics()
    };
  }

  cleanup () {
    this.connection.close();
  }
}

module.exports = Scenario;