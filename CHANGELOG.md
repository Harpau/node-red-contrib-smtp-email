# Changelog

## 1.0.0 (unreleased)

### Added

- Check SMTP connectivity, TLS and configured authentication when a send node
  starts after a deploy or Node-RED restart, without sending an email.
- Show `connecting`, `connected` or a sanitized connection error below the node.
  Checks have a 15-second status deadline and separate network timeouts.
- Share concurrent checks for send nodes using the same account. Discard stale
  results after redeploy and keep late checks from replacing send status.
- Add the MIT license and declare Node-RED `>=4.0.0` in the Node-RED package
  metadata. Node.js `>=22.0.0` remains required.

### Changed

- Update Nodemailer to `^9.1.1` for security fixes.
- Document the existing partial recipient acceptance behavior: a successful
  SMTP send uses output 1 when at least one recipient is accepted, even if
  others are rejected. A downstream IMAP acknowledgement may therefore
  complete the original email; `msg.smtpEmail.rejected` identifies rejected
  recipients.
- Document that a successful connection check is not a persistent connection
  or a guarantee of final delivery. Failed checks do not block later sends.

## 0.1.0

- Initial SMTP account and send nodes with configurable field sources,
  attachments, send metadata and separate success and failure outputs.
- Support forwarding the documented `msg.email` structure while preserving
  `msg.imap.ackToken` for downstream IMAP acknowledgement.
