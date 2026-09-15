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

### Connection check on deploy

Each send node checks its configured SMTP connection when it starts, including
on Node-RED startup, a full deploy, and a deploy that restarts the node after
changes to its settings or account credentials. A partial deploy checks only
the send nodes that restart. Send nodes using the same account share a check
while it is in progress; later starts perform a new check.

The check verifies the connection, configured TLS settings and, when login
values are configured, authentication. Authentication must succeed even if the
server does not advertise AUTH. Accounts without login values can use SMTP
relays that do not require authentication. The check does not send an email.

Node status during the check:

| Status | Display | Meaning |
| --- | --- | --- |
| `connecting` | yellow ring | connection check is in progress |
| `connected` | green dot | connection and configured authentication succeeded |
| `auth failed` | red ring | configured authentication failed or is unavailable |
| `host not found` | red ring | SMTP hostname could not be resolved |
| `connection failed` | red ring | connection was refused, interrupted or failed |
| `TLS error` | red ring | TLS negotiation or certificate validation failed |
| `timeout` | red ring | the connection check exceeded its time limit |
| `missing account` | red ring | SMTP account configuration is missing |
| `invalid account` | red ring | SMTP account configuration is incomplete or invalid |

`connected` describes the last successful check. The test connection is closed
afterwards; this is not a persistent connection or a guarantee of future
availability, acceptance of a particular email or final delivery. The status
waits at most 15 seconds for the check. Separate network timeouts limit the
underlying connection work; cancellation does not guarantee that an in-flight
connection closes immediately.

The check is asynchronous, produces no output messages and does not change the
send counts. A failed check does not block later send attempts. Results from
closed or redeployed nodes are discarded. Once the node receives its first
message, sending controls the status; a late check result cannot overwrite it.

Node status after a message arrives:

| Status | Meaning |
| --- | --- |
| `sending` | SMTP send is in progress |
| `sent N` | last send succeeded; volatile sent count |
| `failed N` | planning or sending failed; volatile failed count |
| `sent N, failed M` | both counts are shown after mixed outcomes |

The sent and failed counts are kept in memory per node instance and reset on
deploy or restart. Status text does not include SMTP hosts, account values,
recipient addresses or SMTP error details.

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

Partial recipient acceptance is a successful send: output 1 can trigger the
IMAP acknowledgement even when some recipients are rejected. The example's
acknowledgement deletes the original email in this case. This is intentional;
see [Delivery Semantics](#delivery-semantics) for details.

`msg.imap` belongs to the IMAP package. `smtp email send` keeps the original
message object moving through the flow and does not remove or replace
`msg.imap.ackToken`.

## Delivery Semantics

On successful send:

- the original `msg` is sent on output 1
- `msg.imap` is preserved
- `msg.imap.ackToken` is preserved
- `msg.smtpEmail` contains SMTP result metadata

SMTP acceptance is not a guarantee of final delivery. If the SMTP server accepts
at least one recipient and Nodemailer reports a successful send, the node uses
output 1 and increments the sent count, even if other recipients were rejected.
Accepted recipients are listed in `msg.smtpEmail.accepted`; rejected recipients
are listed in `msg.smtpEmail.rejected`.

For example, a result with `accepted: ["recipient@example.invalid"]` and
`rejected: ["other@example.invalid"]` still uses output 1. A downstream
`imap email ack` can therefore delete, move or flag the original email despite
those rejected recipients. This behavior is intentional. Flows that require
acceptance for every recipient can inspect `msg.smtpEmail.rejected` before
acknowledging the original email.

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
npm audit
npm run pack:check
```

## License

This package is available under the [MIT License](LICENSE).
