"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");

test("README documents the required user-facing topics", () => {
  for (const text of [
    "@compeso/node-red-contrib-smtp-email",
    "Node.js `>=22.0.0`",
    "Node-RED `>=4.0.0`",
    "`smtp-email account`",
    "`smtp-email send`",
    "Node status",
    "Connection check on deploy",
    "`connecting`",
    "`connected`",
    "`auth failed`",
    "`host not found`",
    "`connection failed`",
    "`TLS error`",
    "`timeout`",
    "`invalid account`",
    "15 seconds",
    "`sending`",
    "`sent N`",
    "`failed N`",
    "`sent N, failed M`",
    "`missing account`",
    "kept in memory per node instance",
    "deploy or restart",
    "Field Sources",
    "no global compose or forward mode",
    "`email.header.reply-to`",
    "`email.topic`",
    "`email.text`",
    "`email.html`",
    "`email.attachments`",
    "`msg.to`",
    "`msg.cc`",
    "`msg.bcc`",
    "`msg.replyTo`",
    "`msg.attachments`",
    "They are not used automatically",
    "`msg.smtpEmail`",
    "`msg.smtpEmail.accepted`",
    "`msg.smtpEmail.rejected`",
    "Partial recipient acceptance",
    "`msg.imap.ackToken`",
    "examples/imap-forward-to-smtp.json",
    "output 1",
    "output 2",
    "No direct dependency on `@compeso/node-red-contrib-imap-email`",
    "[MIT License](LICENSE)",
    "[CHANGELOG.md](CHANGELOG.md)",
  ]) {
    assert.match(readme, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("README uses placeholder endpoints and no credential examples", () => {
  assert.match(readme, /smtp\.example\.invalid/);
  assert.match(readme, /recipient@example\.invalid/);
  assert.match(readme, /forwarder@example\.invalid/);

  assert.doesNotMatch(readme, /smtp\.(gmail|outlook|office365|yahoo|icloud|hotmail)\.com/i);
  assert.doesNotMatch(readme, /(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i);
  assert.doesNotMatch(readme, /"(password|pass|token|secret|auth|username|user)"\s*:/i);
});
