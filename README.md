# node-red-contrib-smtp-email

SMTP email send nodes for Node-RED.

This package provides a Node-RED SMTP sender. It does not receive mail and it
does not manage IMAP acknowledgements.

## Package

- npm package: `@compeso/node-red-contrib-smtp-email`
- Node-RED types:
  - `smtp-email account`
  - `smtp-email send`
- Palette labels:
  - `smtp email account`
  - `smtp email send`

## Requirements

- Node.js `>=22.0.0`
- Node-RED `>=4.0.0`

## Installation

Install the package into your Node-RED user directory:

```bash
npm install @compeso/node-red-contrib-smtp-email
```

Restart Node-RED after installation so the new nodes appear in the palette.

## Nodes

### smtp email account

`smtp email account` is a shared configuration node for SMTP connection
settings:

- SMTP host, for example `smtp.example.invalid`
- SMTP port
- TLS from connection start
- certificate validation
- default sender address, for example `forwarder@example.invalid`
- SMTP login values stored as Node-RED credentials

Login values are stored through Node-RED's credential mechanism. They are not
message fields and should not be added to example flows or logs.

### smtp email send

`smtp email send` sends one email for each incoming message. It has one input
and two outputs:

- output 1: send succeeded
- output 2: send failed

The node writes SMTP delivery metadata to `msg.smtpEmail`.

On success, `msg.smtpEmail` may contain:

- `messageId`
- `accepted`
- `rejected`
- `response`

On failure, `msg.smtpEmail.error` contains a sanitized error message.

Node status:

| Status | Meaning |
| --- | --- |
| `sending` | SMTP send is in progress |
| `sent` | last send succeeded |
| `missing account` | SMTP account configuration is missing |
| `failed` | planning or sending failed; see `msg.smtpEmail.error` |

## Field Sources

The send node has no global compose or forward mode. Each outgoing email field
has its own source selector:

- `msg`: read a value from a message path, for example `email.text`
- `string`: use a fixed string from the node configuration

The path value is relative to `msg`, so `email.text` reads `msg.email.text`.
Empty optional fields are omitted. If `from` is empty, the account default
sender is used.

Default field mapping:

| Email field | Default source | Default value | Notes |
| --- | --- | --- | --- |
| `to` | `string` | empty | required before sending |
| `cc` | `string` | empty | optional |
| `bcc` | `string` | empty | optional |
| `from` | `string` | empty | falls back to account sender |
| `replyTo` | `msg` | `email.header.reply-to` | matches `imap email in` headers |
| `subject` | `msg` | `email.topic` | matches `imap email in` subject |
| `text` | `msg` | `email.text` | plain text body |
| `html` | `msg` | `email.html` | HTML body |
| `attachments` | `msg` | `email.attachments` | must resolve to an array |

At least one recipient and either text or HTML content are required. A non-empty
fixed string is not accepted for attachments; use a message path for attachment
arrays.

The top-level fields `msg.to`, `msg.cc`, `msg.bcc`, `msg.from`,
`msg.replyTo`, `msg.subject`, `msg.payload`, `msg.html` and
`msg.attachments` are still usable by configuring the matching path explicitly.
They are not used automatically.

For messages from `imap email in`, the default mapping already reads subject,
body, HTML, reply-to and attachments from the documented `msg.email` structure.
Recipient fields are intentionally empty by default so a flow does not send to
the original recipients by accident.

## IMAP Forwarding

This package does not include IMAP receive, delete, move, flag or acknowledge
features. IMAP integration happens only through the Node-RED message object.

Recommended flow:

```text
imap email in -> smtp email send -> imap email ack
```

Configure the `To` field on `smtp email send`, for example as the fixed string
`recipient@example.invalid`. Leave the default `msg.email` mappings for subject,
body, HTML, reply-to and attachments when forwarding messages from
`imap email in`.

The example flow is available at:

```text
examples/imap-forward-to-smtp.json
```

In this flow, SMTP output 1 goes to `imap email ack`. SMTP output 2 goes to a
debug node. Do not wire the failure output to an IMAP acknowledgement node,
otherwise an original email could be acknowledged after a failed forward.

`msg.imap` belongs to the IMAP package. `smtp email send` keeps the original
message object moving through the flow and does not remove or replace
`msg.imap.ackToken`.

## Delivery Semantics

On successful send:

- the original `msg` is sent on output 1
- `msg.imap` is preserved
- `msg.imap.ackToken` is preserved
- `msg.smtpEmail` contains SMTP result metadata

On failed send:

- the original `msg` is sent on output 2
- output 1 is not triggered
- `msg.smtpEmail.error` contains a sanitized error
- the failure path should not be connected to an IMAP acknowledgement node

## Examples

The `examples` directory contains importable Node-RED flows. Example values use
reserved placeholder domains such as `smtp.example.invalid` and
`recipient@example.invalid`.

Before using an example flow, replace placeholder accounts and addresses with
values from your own environment inside Node-RED.

## Limits

- No IMAP receive node is included.
- No IMAP acknowledge, delete, move or flag operation is included.
- No direct dependency on `@compeso/node-red-contrib-imap-email`.
- No OAuth2 support yet.
- No real credentials, tokens or private endpoints are included in examples.

## Development Checks

Before larger changes, run:

```bash
npm install
npm test
npm run pack:check
```
