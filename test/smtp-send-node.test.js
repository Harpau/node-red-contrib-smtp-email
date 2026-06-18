"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const registerSmtpEmailSendNode = require("../nodes/smtp-email-send");

function createFakeRed({ accountNode } = {}) {
  const registeredTypes = new Map();

  return {
    registeredTypes,
    RED: {
      nodes: {
        createNode(node) {
          node.handlers = new Map();
          node.on = (event, handler) => {
            node.handlers.set(event, handler);
          };
          node.send = (messages) => {
            node.sentMessages.push(messages);
          };
          node.sentMessages = [];
        },
        getNode(id) {
          return id === "smtp-account-1" ? accountNode : null;
        },
        registerType(type, constructor) {
          registeredTypes.set(type, constructor);
        },
      },
    },
  };
}

function createSendNode({ accountNode, transportFactory, mode = "compose" }) {
  const { RED, registeredTypes } = createFakeRed({ accountNode });

  registerSmtpEmailSendNode(RED, { transportFactory });

  const NodeConstructor = registeredTypes.get("smtp-email send");
  const node = new NodeConstructor({
    name: "send",
    account: "smtp-account-1",
    mode,
  });

  return node;
}

async function runInput(node, msg) {
  const sentMessages = [];
  const doneCalls = [];
  const inputHandler = node.handlers.get("input");

  assert.equal(typeof inputHandler, "function");

  await inputHandler(
    msg,
    (messages) => {
      sentMessages.push(messages);
    },
    (error) => {
      doneCalls.push(error);
    },
  );

  return { sentMessages, doneCalls };
}

test("smtp send node sends planned mail through an injected transport", async () => {
  const ackToken = { id: "ack-token" };
  const accountNode = {
    host: "smtp.example.invalid",
    port: "587",
    secure: false,
    rejectUnauthorized: true,
    from: "sender@example.invalid",
    credentials: {
      username: "test-user",
      password: "test-password",
    },
  };
  let capturedTransportOptions;
  let capturedMailOptions;
  let transportClosed = false;
  const node = createSendNode({
    accountNode,
    transportFactory(options) {
      capturedTransportOptions = options;

      return {
        async sendMail(mailOptions) {
          capturedMailOptions = mailOptions;

          return {
            messageId: "message-id",
            accepted: ["recipient@example.invalid"],
            rejected: [],
            response: "250 queued",
          };
        },
        close() {
          transportClosed = true;
        },
      };
    },
  });
  const msg = {
    to: "recipient@example.invalid",
    payload: "Body",
    imap: { ackToken },
  };

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.deepEqual(capturedTransportOptions, {
    host: "smtp.example.invalid",
    port: 587,
    secure: false,
    tls: {
      rejectUnauthorized: true,
    },
    auth: {
      user: "test-user",
      pass: "test-password",
    },
  });
  assert.deepEqual(capturedMailOptions, {
    to: "recipient@example.invalid",
    from: "sender@example.invalid",
    text: "Body",
  });
  assert.equal(transportClosed, true);
  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(msg.smtpEmail, {
    messageId: "message-id",
    accepted: ["recipient@example.invalid"],
    rejected: [],
    response: "250 queued",
  });
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node routes planning errors to the failure output only", async () => {
  const ackToken = { id: "ack-token" };
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: {
      host: "smtp.example.invalid",
      port: 587,
      from: "sender@example.invalid",
      credentials: {
        username: "test-user",
        password: "test-password",
      },
    },
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const msg = {
    payload: "Body",
    imap: { ackToken },
  };

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.match(msg.smtpEmail.error, /Missing msg\.to for email send/);
  assert.doesNotMatch(msg.smtpEmail.error, /test-password|test-user|smtp\.example\.invalid/);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node routes transport errors to the failure output with sanitized text", async () => {
  const ackToken = { id: "ack-token" };
  let transportClosed = false;
  const node = createSendNode({
    accountNode: {
      host: "smtp.example.invalid",
      port: 587,
      from: "sender@example.invalid",
      credentials: {
        username: "test-user",
        password: "test-password",
      },
    },
    transportFactory() {
      return {
        async sendMail() {
          throw new Error("Login failed for test-user using test-password at smtp.example.invalid");
        },
        close() {
          transportClosed = true;
        },
      };
    },
  });
  const msg = {
    to: "recipient@example.invalid",
    payload: "Body",
    imap: { ackToken },
  };

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportClosed, true);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.equal(msg.smtpEmail.error, "Login failed for [redacted] using [redacted] at [redacted]");
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node routes missing accounts to the failure output", async () => {
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: null,
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const msg = {
    to: "recipient@example.invalid",
    payload: "Body",
  };

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.equal(msg.smtpEmail.error, "SMTP account is not configured");
});

test("smtp send node sanitizes transport factory errors", async () => {
  const node = createSendNode({
    accountNode: {
      host: "smtp.example.invalid",
      port: 587,
      from: "sender@example.invalid",
      credentials: {
        username: "test-user",
        password: "test-password",
      },
    },
    transportFactory() {
      throw new Error("Factory failed for test-user/test-password@smtp.example.invalid");
    },
  });
  const msg = {
    to: "recipient@example.invalid",
    payload: "Body",
  };

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.equal(msg.smtpEmail.error, "Factory failed for [redacted]/[redacted]@[redacted]");
});
