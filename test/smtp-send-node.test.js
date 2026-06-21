"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const registerSmtpEmailSendNode = require("../nodes/smtp-email-send");

const STATUS_FAILED = { fill: "red", shape: "ring", text: "failed" };
const STATUS_MISSING_ACCOUNT = { fill: "red", shape: "ring", text: "missing account" };
const STATUS_SENDING = { fill: "blue", shape: "dot", text: "sending" };
const STATUS_SENT = { fill: "green", shape: "dot", text: "sent" };

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
          node.statusCalls = [];
          node.status = (status) => {
            node.statusCalls.push(status);
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

function createSendNode({ accountNode, transportFactory, config = {} }) {
  const { RED, registeredTypes } = createFakeRed({ accountNode });

  registerSmtpEmailSendNode(RED, { transportFactory });

  const NodeConstructor = registeredTypes.get("smtp-email send");
  const node = new NodeConstructor({
    name: "send",
    account: "smtp-account-1",
    ...config,
  });

  return node;
}

function createAccountNode() {
  return {
    host: "smtp.example.invalid",
    port: "587",
    secure: false,
    rejectUnauthorized: true,
    from: "forwarder@example.invalid",
    credentials: {
      username: "test-user",
      password: "test-password",
    },
  };
}

function createImapMessage({ ackToken = { id: "ack-token" }, attachments } = {}) {
  const msg = {
    topic: "Legacy topic",
    to: "legacy-recipient@example.invalid",
    payload: "Legacy payload",
    email: {
      topic: "IMAP subject",
      from: "Original Sender <original-sender@example.invalid>",
      to: "Original Recipient <original-recipient@example.invalid>",
      cc: "Original Copy <original-copy@example.invalid>",
      bcc: "Original Blind <original-blind@example.invalid>",
      text: "IMAP text",
      html: "<p>IMAP HTML</p>",
      header: {
        "reply-to": "Reply Person <reply@example.invalid>",
      },
    },
    imap: { ackToken },
  };

  if (attachments) {
    msg.email.attachments = attachments;
  }

  return msg;
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

function assertStatusTextsDoNotExposeSecrets(statusCalls) {
  for (const status of statusCalls) {
    assert.doesNotMatch(
      status.text,
      /test-user|test-password|smtp\.example\.invalid|recipient@example\.invalid|new-recipient@example\.invalid/,
    );
  }
}

test("smtp send node sends mapped fields through an injected transport", async () => {
  const ackToken = { id: "ack-token" };
  const attachment = { filename: "note.txt", content: "hello" };
  let capturedTransportOptions;
  let capturedMailOptions;
  let transportClosed = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
      ccSource: "msg",
      ccValue: "email.cc",
      bccSource: "msg",
      bccValue: "email.bcc",
    },
    transportFactory(options) {
      capturedTransportOptions = options;

      return {
        async sendMail(mailOptions) {
          capturedMailOptions = mailOptions;

          return {
            messageId: "message-id",
            accepted: ["new-recipient@example.invalid"],
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
  const msg = createImapMessage({ ackToken, attachments: [attachment] });

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
    to: "new-recipient@example.invalid",
    cc: "Original Copy <original-copy@example.invalid>",
    bcc: "Original Blind <original-blind@example.invalid>",
    from: "forwarder@example.invalid",
    replyTo: "Reply Person <reply@example.invalid>",
    subject: "IMAP subject",
    text: "IMAP text",
    html: "<p>IMAP HTML</p>",
    attachments: [attachment],
  });
  assert.equal(capturedMailOptions.attachments[0], attachment);
  assert.equal(transportClosed, true);
  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_SENDING, STATUS_SENT]);
  assert.deepEqual(msg.smtpEmail, {
    messageId: "message-id",
    accepted: ["new-recipient@example.invalid"],
    rejected: [],
    response: "250 queued",
  });
  assert.equal(msg.smtpEmail.error, undefined);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node shows sending while sendMail is pending", async () => {
  let resolveSendMail;
  let sendMailStarted;
  const sendMailStartedPromise = new Promise((resolve) => {
    sendMailStarted = resolve;
  });
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      return {
        async sendMail() {
          sendMailStarted();
          return new Promise((resolve) => {
            resolveSendMail = resolve;
          });
        },
        close() {},
      };
    },
  });
  const msg = createImapMessage();

  const inputPromise = runInput(node, msg);

  await sendMailStartedPromise;
  assert.deepEqual(node.statusCalls, [STATUS_SENDING]);

  resolveSendMail({ messageId: "message-id" });
  const { sentMessages, doneCalls } = await inputPromise;

  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_SENDING, STATUS_SENT]);
});

test("smtp send node can send fixed string content fields", async () => {
  let capturedMailOptions;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
      subjectSource: "str",
      subjectValue: "Fixed subject",
      textSource: "str",
      textValue: "Fixed body",
      htmlSource: "str",
      htmlValue: "",
      attachmentsSource: "str",
      attachmentsValue: "",
    },
    transportFactory() {
      return {
        async sendMail(mailOptions) {
          capturedMailOptions = mailOptions;
          return { messageId: "message-id" };
        },
        close() {},
      };
    },
  });

  const { sentMessages, doneCalls } = await runInput(node, createImapMessage());

  assert.deepEqual(capturedMailOptions, {
    to: "recipient@example.invalid",
    from: "forwarder@example.invalid",
    replyTo: "Reply Person <reply@example.invalid>",
    subject: "Fixed subject",
    text: "Fixed body",
  });
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0][1], null);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_SENDING, STATUS_SENT]);
});

test("smtp send node does not automatically use legacy mode msg.to or msg.payload", async () => {
  const ackToken = { id: "ack-token" };
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      mode: "forward",
      textSource: "str",
      textValue: "",
      htmlSource: "str",
      htmlValue: "",
    },
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const msg = createImapMessage({ ackToken });

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_FAILED]);
  assert.match(msg.smtpEmail.error, /Missing configured email recipient/);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node routes attachment string configuration errors to failure output", async () => {
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
      attachmentsSource: "str",
      attachmentsValue: "attachment.txt",
    },
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const msg = createImapMessage();

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_FAILED]);
  assert.match(msg.smtpEmail.error, /Attachments cannot be configured as a fixed string/);
});

test("smtp send node routes transport errors to failure output with sanitized text", async () => {
  const ackToken = { id: "ack-token" };
  let transportClosed = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
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
  const msg = createImapMessage({ ackToken });

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportClosed, true);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_SENDING, STATUS_FAILED]);
  assertStatusTextsDoNotExposeSecrets(node.statusCalls);
  assert.equal(msg.smtpEmail.error, "Login failed for [redacted] using [redacted] at [redacted]");
  assert.doesNotMatch(msg.smtpEmail.error, /test-password|test-user|smtp\.example\.invalid/);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("smtp send node ignores close errors after successful send", async () => {
  let closeCalled = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      return {
        async sendMail() {
          return {
            messageId: "message-id",
            accepted: ["recipient@example.invalid"],
          };
        },
        close() {
          closeCalled = true;
          throw new Error("close failed");
        },
      };
    },
  });
  const msg = createImapMessage();

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(closeCalled, true);
  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_SENDING, STATUS_SENT]);
  assert.equal(msg.smtpEmail.messageId, "message-id");
  assert.equal(msg.smtpEmail.error, undefined);
});

test("smtp send node routes missing accounts to the failure output", async () => {
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: null,
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const msg = createImapMessage();

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_MISSING_ACCOUNT]);
  assert.equal(msg.smtpEmail.error, "SMTP account is not configured");
});

test("smtp send node sanitizes transport factory errors", async () => {
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      throw new Error("Factory failed for test-user/test-password@smtp.example.invalid");
    },
  });
  const msg = createImapMessage();

  const { sentMessages, doneCalls } = await runInput(node, msg);

  assert.deepEqual(sentMessages, [[null, msg]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_FAILED]);
  assertStatusTextsDoNotExposeSecrets(node.statusCalls);
  assert.equal(msg.smtpEmail.error, "Factory failed for [redacted]/[redacted]@[redacted]");
});
