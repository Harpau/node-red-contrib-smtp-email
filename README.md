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

## Message Modes

The send node supports two mode values.

### `compose`

`compose` creates a new email from message fields.

Supported input fields:

- `msg.to`
- `msg.cc`
- `msg.bcc`
- `msg.from`
- `msg.replyTo`
- `msg.subject`
- `msg.payload`
- `msg.html`
- `msg.attachments`

`msg.to` is required. `msg.payload` is used as the plain text body when it is a
string or buffer. `msg.html` can be used for an HTML body. If `msg.from` is not
set, the account default sender is used.

Example message:

```json
{
  "to": "recipient@example.invalid",
  "subject": "Status update",
  "payload": "Plain text body",
  "html": "<p>HTML body</p>"
}
```

### `forward`

`forward` creates a new forwarded email from a structured incoming email. This
mode is designed to work with an external IMAP input node without creating a
runtime dependency on that IMAP package.

The new recipient is read from `msg.to`. Optional new copy recipients are read
from `msg.cc` and `msg.bcc`. `msg.from` can override the account default sender.
`msg.replyTo` sets the reply-to address of the forwarded email.

The original email content is read from a structured `msg.email` object, or from
a structured object in `msg.payload` when `msg.email` is not present. The
structured object may contain:

- `subject`
- `text`
- `html`
- `attachments`

If `msg.subject` is not set, the node creates a subject like
`Fwd: Original subject`. If the original subject is missing, it uses
`Fwd: forwarded email`.

If no structured text or HTML content is available, the node sends the message
to the failure output with a clear error.

## IMAP Forwarding

This package does not include IMAP receive, delete, move, flag or acknowledge
features. IMAP integration happens only through the Node-RED message object.

Recommended flow:

```text
imap email in -> smtp email send -> imap email ack
```

Use `smtp email send` in mode `forward`. Set the new recipient before the SMTP
node, for example with a Change node that sets `msg.to` to
`recipient@example.invalid`.

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
