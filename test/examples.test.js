"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const examplesDir = path.join(rootDir, "examples");
const examplePath = path.join(examplesDir, "imap-forward-to-smtp.json");

function readExample(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function indexById(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function canReachNodeType(startIds, nodesById, targetType) {
  const visited = new Set();
  const queue = [...startIds];

  while (queue.length > 0) {
    const id = queue.shift();

    if (visited.has(id)) {
      continue;
    }

    visited.add(id);

    const node = nodesById.get(id);

    if (!node) {
      continue;
    }

    if (node.type === targetType) {
      return true;
    }

    for (const wireGroup of node.wires || []) {
      queue.push(...wireGroup);
    }
  }

  return false;
}

test("examples directory contains the IMAP forwarding flow", () => {
  const exampleFiles = fs.readdirSync(examplesDir).filter((file) => file.endsWith(".json"));

  assert.ok(exampleFiles.length > 0);
  assert.ok(exampleFiles.includes("imap-forward-to-smtp.json"));
});

test("IMAP forwarding example wires SMTP success to ack and failure away from ack", () => {
  const flow = readExample(examplePath);
  const nodesById = indexById(flow);
  const smtpSend = nodesById.get("smtp-forward-send");

  assert.ok(Array.isArray(flow));
  assert.equal(nodesById.get("imap-email-in").type, "imap-email in");
  assert.equal(smtpSend.type, "smtp-email send");
  assert.equal(Object.prototype.hasOwnProperty.call(smtpSend, "mode"), false);
  assert.equal(smtpSend.toSource, "str");
  assert.equal(smtpSend.toValue, "recipient@example.invalid");
  assert.equal(smtpSend.ccSource, "str");
  assert.equal(smtpSend.ccValue, "");
  assert.equal(smtpSend.bccSource, "str");
  assert.equal(smtpSend.bccValue, "");
  assert.equal(smtpSend.fromSource, "str");
  assert.equal(smtpSend.fromValue, "");
  assert.equal(smtpSend.replyToSource, "msg");
  assert.equal(smtpSend.replyToValue, "email.header.reply-to");
  assert.equal(smtpSend.subjectSource, "msg");
  assert.equal(smtpSend.subjectValue, "email.topic");
  assert.equal(smtpSend.textSource, "msg");
  assert.equal(smtpSend.textValue, "email.text");
  assert.equal(smtpSend.htmlSource, "msg");
  assert.equal(smtpSend.htmlValue, "email.html");
  assert.equal(smtpSend.attachmentsSource, "msg");
  assert.equal(smtpSend.attachmentsValue, "email.attachments");
  assert.equal(nodesById.get("imap-email-ack").type, "imap-email ack");

  assert.deepEqual(nodesById.get("imap-email-in").wires, [["smtp-forward-send"]]);
  assert.deepEqual(smtpSend.wires, [["imap-email-ack"], ["smtp-forward-error"]]);
  assert.equal(canReachNodeType(smtpSend.wires[0], nodesById, "imap-email ack"), true);
  assert.equal(canReachNodeType(smtpSend.wires[1], nodesById, "imap-email ack"), false);
});

test("IMAP forwarding example uses placeholders and no credentials", () => {
  const flow = readExample(examplePath);
  const serialized = JSON.stringify(flow);
  const forbiddenKeyPattern = /"(password|pass|token|secret|auth|username|user)"\s*:/i;
  const forbiddenValuePattern = /(gmail|outlook|office365|yahoo|icloud|hotmail|localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;

  assert.doesNotMatch(serialized, forbiddenKeyPattern);
  assert.doesNotMatch(serialized, forbiddenValuePattern);
  assert.match(serialized, /imap\.example\.invalid/);
  assert.match(serialized, /smtp\.example\.invalid/);
  assert.match(serialized, /recipient@example\.invalid/);
  assert.match(serialized, /forwarder@example\.invalid/);
});
