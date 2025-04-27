# Kamehameha

Tools for testing the AMQP 1.0 messaging client (rhea) and servers.

Support for TLS, message encryption, and digital signatures.

Inspired by quiver (https://github.com/ssorj/quiver).
Built with Node.js and the rhea (https://github.com/amqp/rhea) library.

## Overview

The AMQP client are implemented using the NodeJS rhea (https://github.com/amqp/rhea) library. While the combination of nodejs + rhea might not give the best performance, it might help visualizing the worst case scenario when implementing
a client application.

The `kame.js` command runs a client and will try to send a message as fast as possible to the servers until it reach the specified count.

The scripts in `benchmarks` folder contains scripts that emulate several usage scenarios.

## Command Line Interface

### kame.js

Depending on the options selected, it will starts either a sender-receiver pair, or sender or receiver only.

```
usage: kame.js [--help] [--version] [--host HOST] [--port PORT] [--username USERNAME] [--password PASSWORD]
               [--address QUEUE_NAME] [--count MESSAGE_COUNT] [--mode MODE] [--payload FILE_PATH] [--output DIR]
               [--tls] [--key FILE_PATH] [--cert FILE_PATH] [---ca FILE_PATH] [--servername SERVER_NAME]
               [--sign] [--signKey FILE_PATH] [--signCert FILE_PATH]
               [--encrypt] [--encryptKey FILE_PATH] [--encryptPath FILE_PATH]
TLS
  -s, --tls         Use TLS (AMQPS) connection
      --key         The client TLS private key file
      --cert        The client TLS public key file
      --ca          The CA certificate file
      --servername  Server name for TLS verification

Message Encryption
      --encrypt     Enable message body encryption.
      --encryptKey  The receipient public key for message encryption
      --decryptKey  The receipient private key for message descryption

Message Signing
      --sign      Enable message body signing.
      --signKey   The sender private key for message signing.
      --signCert  The sender public key for message signing verification.
                                                                        [string]
Options:
      --version   Show version number
      --host      The AMQP server host address.
      --port      The AMQP server port number.
      --username  Username for the connection. (For non-TLS connection.)
      --password  Password for the connection. (For non-TLS connection.)
      --address   The queue name
      --count     Number of messages to send           [number] [default: 10000]
      --mode      Mode of operation (sender, receiver, both)
      --payload   File for the message body.
      --output    Output path for the results
      --help      Show help


HOST:
 IP Address or Host name

PORT:
 Port number, default is 5672

USERNAME:
 The username for plain connection, if TLS enabled, this is not needed as `kame` will use sasl_external where username is extracted from the certificate.

PASSWORD:
 The password for plain connection, if TLS is enabled, this is not needed as `kame` will use sasl_external where authentication is expected using the client private key.

QUEUE_NAME:
 The name of the queue on the AMQP server.

MESSAGE_COUNT:
 The number of message to sent or expected to receive.

MODE:
  The mode of test, either act as sender, receiver or both

FILE_PATH:
  Path to a file, either relative or absolute.

DIR:
  Directory path for test result output. If none given, default will be `/tmp/kame-{timestamp}-{uuid}`

SERVER_NAME:
  A string for the server name that match the server certificate.
```

## Examples

### PLAIN connection.

```bash
# This will run as both sender and receiver.
# Note: When no payload is specified, `kame` will use the string `Hello World` as the body payload.
$ node <app_dir>/src/kame.js --host localhost --port 5672 --username guest --password guest --count 10000 --address benchmark

# Sender-receiver with custom payload
$ node <app_dir>/src/kame.js --host localhost --port 5672 --username guest --password guest --count 10000 --address benchmark --payload path/to/custom_payload

# Sender/publisher mode
$ node <app_dir>/src/kame.js --host localhost --port 5672 --username guest --password guest --count 10000 --address benchmark --mode sender

# Receiver/consumer mode
$ node <app_dir>/src/kame.js --host localhost --port 5672 --username guest --password guest --count 10000 --address benchmark --mode receiver
```

### TLS connection.

```bash
# TLS connection with custom payload
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key /path/to/private_key.pem --cert /path/to/public/key --servername the_server_name --ca /path/to/ca_cert --payload path/to/custom_payload

# Sender/Publisher mode
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key /path/to/private_key.pem --cert /path/to/public/key --servername the_server_name --ca /path/to/ca_cert --payload path/to/custom_payload --mode sender

# Receiver/Consumer mode
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key /path/to/private_key.pem --cert /path/to/public/key --servername the_server_name --ca /path/to/ca_cert --payload path/to/custom_payload --mode receiver
```

### Digital Signature

```bash
# TLS connection, sender-receiver, custom payload with digital signature
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign --signKey path/to/sender_private_key.pem --signCert path/to/sender_public_key.pem --payload path/to/custom_payload

# TLS connection, sender mode, custom payload with digital signature
# --signCert is not needed as we are not doing the signature verification
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign --signKey path/to/sender_private_key.pem --payload path/to/custom_payload --mode sender

# TLS connection, receiver mode, custom payload with digital signature
# --signKey is not needed as we are not doing the signing, only verification
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign --signCert path/to/sender_public_key.pem --payload path/to/custom_payload --mode receiver
```

### Digital Signature with Message Encryption

```bash
# TLS connection, sender-receiver, custom payload with digital signature and message encryption
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign --signKey path/to/sender_private_key.pem --signCert path/to/sender_public_key.pem --encrypt --encryptKey path/to/recipient_public_key.pem --decryptKey path/to/recipient_private_key.pem --payload path/to/custom_payload

# TLS connection, sender mode, custom payload with digital signature and message encryption
# --signCert and --decryptKey is not needed, as we are not doing signature verification and message decryption
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign --signKey path/to/sender_private_key.pem --encrypt --encryptKey path/to/recipient_public_key.pem --payload path/to/custom_payload --mode sender

# TLS connection, receiver mode, custom payload with digital signature and message encryption
# --signKey and --encryptKey is not needed, as we are not doing message signing and message encryption
$ node <app_dir>/src/kame.js --host localhost --port 5671 --count 10000 --address benchmark --tls --key path/to/private_key.pem --cert path/to/public_key.pem --servername the_server_name --ca path/to/ca_cert.pem --sign -signCert path/to/sender_public_key.pem --encrypt --decryptKey path/to/recipient_private_key.pem --payload path/to/custom_payload --mode sender
```

## Benchmark Scenarios

The following scripts, contains preset for benchmarking the broker with few scenarios

- `benchmark-both-small.js` - Run series of test scenarios using a small sized message payload.
- `benchmark-both-tac.js` - Run series of test scenarios using a medium sized message payload.
- `benchmark-both-fixm.js` - Run series of test scenarios using a large size message payload.

The scripts depends on the environment variables defined in `.env` file, copy the `env.example` file
to `.env` and adjust the variable accordingly.

To run the test

```bash
# Run test using a small sized payloads.
$ node ./src/bechmark-both-small.js

# Run test using a medium sized payloads.
$ node ./src/benchmark-both-tac.js

# Run test using a large size payloads.
$ node ./src/benchmark-both-fixm.js
```

## Prerequisites

- Node.js 14.x or higher
- AMQP broker (e.g., RabbitMQ, Apache Qpid)
- SSL certificates (if using TLS)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd kamehameha

# Install dependencies
npm install
```

## License

Teh Tarik License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
