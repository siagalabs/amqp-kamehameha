/*
 *   Copyright (c) 2025 Siaga Laboratories Sdn. Bhd.
 *   All rights reserved.
 *   Author: Mohd Azmadi Abdullah <azmadi@siagalabs.com>
 */
const { fork } = require('child_process');
require('dotenv').config();
const crypto = require('crypto');

const scenarios = [
  {
    name: 'Small Payload - No TLS',
    disabled: false,
    description: 'Measurement of message exchange time without TLS using a small message payload',
    args: [
      '--host', process.env.SELF_TEST_HOST,
      '--port', process.env.SELF_TEST_PORT,
      '--username', process.env.SELF_TEST_USERNAME,
      '--password', process.env.SELF_TEST_PASSWORD,
      '--address', process.env.SELF_TEST_QUEUE,
      '--count', process.env.SELF_TEST_SMALL_MESSAGE_COUNT,
      '--payload', process.env.SELF_TEST_SMALL_PAYLOAD_FILE,
      '--output', `/tmp/kame-benchmark-small-no-tls-${Date.now()}-${process.env.SELF_TEST_HOST}-${crypto.randomUUID()}`
    ]
  },

  {
    name: 'Small Payload - TLS',
    disabled: false,
    description: 'Measurement of message exchange time with TLS and certificate authentication using a small message payload',
    args: [
      '--host', process.env.SELF_TEST_HOST,
      '--port', process.env.SELF_TEST_TLS_PORT,
      '--address', process.env.SELF_TEST_QUEUE,
      '--count', process.env.SELF_TEST_SMALL_MESSAGE_COUNT,
      '--payload', process.env.SELF_TEST_SMALL_PAYLOAD_FILE,
      '--tls',
      '--key', process.env.SELF_TEST_TLS_KEY_PATH,
      '--cert', process.env.SELF_TEST_TLS_CERT_PATH,
      '--ca', process.env.SELF_TEST_TLS_CA_PATH,
      '--servername', process.env.SELF_TEST_TLS_SERVER_NAME,
      '--output', `/tmp/kame-benchmark-small-tls-${Date.now()}-${process.env.SELF_TEST_HOST}-${crypto.randomUUID()}`
    ]
  },

  {
    name: 'Small Payload - TLS - Digital Signature',
    disabled: false,
    description: 'Measurement of message exchange time with TLS and certificate authentication using a small message payload with digital signature',
    args: [
      '--host', process.env.SELF_TEST_HOST,
      '--port', process.env.SELF_TEST_TLS_PORT,
      '--address', process.env.SELF_TEST_QUEUE,
      '--count', process.env.SELF_TEST_SMALL_MESSAGE_COUNT,
      '--payload', process.env.SELF_TEST_SMALL_PAYLOAD_FILE,
      '--tls',
      '--key', process.env.SELF_TEST_TLS_KEY_PATH,
      '--cert', process.env.SELF_TEST_TLS_CERT_PATH,
      '--ca', process.env.SELF_TEST_TLS_CA_PATH,
      '--servername', process.env.SELF_TEST_TLS_SERVER_NAME,
      '--sign',
      '--signKey', process.env.SELF_TEST_SIGN_PRIVATE_KEY_PATH,
      '--signCert', process.env.SELF_TEST_SIGN_PUBLIC_KEY_PATH,
      '--output', `/tmp/kame-benchmark-small-tls-signed-${Date.now()}-${process.env.SELF_TEST_HOST}-${crypto.randomUUID()}`
    ]
  },

  {
    name: 'Small Payload - TLS - Digital Signature and Encryption',
    disabled: false,
    description: 'Measurement of message exchange time with TLS and certificate authentication using a small message payload with digital signature and encryption',
    args: [
      '--host', process.env.SELF_TEST_HOST,
      '--port', process.env.SELF_TEST_TLS_PORT,
      '--address', process.env.SELF_TEST_QUEUE,
      '--count', process.env.SELF_TEST_SMALL_MESSAGE_COUNT,
      '--payload', process.env.SELF_TEST_SMALL_PAYLOAD_FILE,
      '--tls',
      '--key', process.env.SELF_TEST_TLS_KEY_PATH,
      '--cert', process.env.SELF_TEST_TLS_CERT_PATH,
      '--ca', process.env.SELF_TEST_TLS_CA_PATH,
      '--servername', process.env.SELF_TEST_TLS_SERVER_NAME,
      '--sign',
      '--signKey', process.env.SELF_TEST_SIGN_PRIVATE_KEY_PATH,
      '--signCert', process.env.SELF_TEST_SIGN_PUBLIC_KEY_PATH,
      '--encrypt',
      '--encryptKey', process.env.SELF_TEST_ENCRYPT_PUBLIC_KEY_PATH,
      '--decryptKey', process.env.SELF_TEST_ENCRYPT_PRIVATE_KEY_PATH,
      '--output', `/tmp/kame-benchmark-small-tls-signed-encrypted-${Date.now()}-${process.env.SELF_TEST_HOST}-${crypto.randomUUID()}`
    ]
  }
];

async function main () {
  // Loop through each scenario and run the test by forking the kame process
  // and wait for the process to finish before proceeding to the next one
  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    if (scenario.disabled) {
      // console.log(`Skipping scenario: ${scenario.name}`);
      continue;
    }

    const p = new Promise((resolve) => {

      const args = [
        ...scenario.args,
        '--mode', 'both'
      ];

      console.log(`\nRunning scenario: ${scenario.name}`);
      console.log(`Description: ${scenario.description}`);
      // console.log(`Arguments: ${args.join(' ')}`);

      // Fork the kamehameha process with the arguments
      const child = fork('./src/kame.js', args);

      child.on('exit', (code) => {
        console.log(`\nScenario ${scenario.name} finished with exit code ${code}`);
        resolve(code)
      });
    })

    await p
  }
}

main()
  .then(() => {
    console.log('\nAll scenarios completed');
  })
  .catch((error) => {
    console.error('Error running scenarios:', error);
  });

