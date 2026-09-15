"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const registerSmtpEmailSendNode = require("../nodes/smtp-email-send");

const STATUS_CONNECTING = { fill: "yellow", shape: "ring", text: "connecting" };
const STATUS_CONNECTED = { fill: "green", shape: "dot", text: "connected" };
const STATUS_MISSING_ACCOUNT = { fill: "red", shape: "ring", text: "missing account" };
const STATUS_SENDING = { fill: "blue", shape: "dot", text: "sending" };

function failedStatus(text) {
  return { fill: "red", shape: "ring", text };
}

function sentStatus(text) {
  return { fill: "green", shape: "dot", text };
}

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

function createSendNode({ accountNode, transportFactory, verifyAccount = async () => "connected", config = {} }) {
  const { RED, registeredTypes } = createFakeRed({ accountNode });

  registerSmtpEmailSendNode(RED, { transportFactory, verifyAccount });

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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

test("smtp send node verifies its configured account on start without sending a message", async () => {
  const verification = deferred();
  const accountNode = createAccountNode();
  const transportFactory = () => assert.fail("the injected verifier must control the probe transport");
  let verificationOptions;
  const node = createSendNode({
    accountNode,
    transportFactory,
    verifyAccount(options) {
      verificationOptions = options;
      return verification.promise;
    },
  });

  assert.equal(verificationOptions.account, accountNode);
  assert.equal(verificationOptions.transportFactory, transportFactory);
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING]);
  assert.deepEqual(node.sentMessages, []);

  verification.resolve("connected");
  await Promise.resolve();

  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_CONNECTED]);
  assert.deepEqual(node.sentMessages, []);
  assert.equal(node.sentCount, 0);
  assert.equal(node.failedCount, 0);
});

for (const result of ["auth failed", "host not found", "connection failed", "TLS error", "timeout", "invalid account"]) {
  test(`smtp send node displays ${result} for a failed deploy check`, async () => {
    const node = createSendNode({
      accountNode: createAccountNode(),
      verifyAccount: async () => result,
    });

    await Promise.resolve();

    assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus(result)]);
    assert.deepEqual(node.sentMessages, []);
    assert.equal(node.sentCount, 0);
    assert.equal(node.failedCount, 0);
    assertStatusTextsDoNotExposeSecrets(node.statusCalls);
  });
}

test("smtp send node immediately displays a missing account without attempting verification", () => {
  const node = createSendNode({
    accountNode: null,
    verifyAccount() {
      assert.fail("a missing account must not be verified");
    },
  });

  assert.deepEqual(node.statusCalls, [STATUS_MISSING_ACCOUNT]);
  assert.deepEqual(node.sentMessages, []);
  assert.equal(node.sentCount, 0);
  assert.equal(node.failedCount, 0);
});

test("smtp send node hides unexpected verifier errors and results", async () => {
  const privateDetails = "test-user/test-password@smtp.example.invalid";
  const verifiers = [
    () => { throw new Error(privateDetails); },
    async () => { throw new Error(privateDetails); },
    async () => privateDetails,
  ];

  for (const verifyAccount of verifiers) {
    const node = createSendNode({ accountNode: createAccountNode(), verifyAccount });

    await Promise.resolve();

    assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus("connection failed")]);
    assert.deepEqual(node.sentMessages, []);
    assertStatusTextsDoNotExposeSecrets(node.statusCalls);
  }
});

test("smtp send node can send after an unsuccessful deploy check", async () => {
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: { toSource: "str", toValue: "recipient@example.invalid" },
    verifyAccount: async () => "auth failed",
    transportFactory() {
      return { async sendMail() { return { messageId: "message-id" }; } };
    },
  });

  await Promise.resolve();
  const msg = createImapMessage();
  const { sentMessages } = await runInput(node, msg);

  assert.deepEqual(node.statusCalls, [
    STATUS_CONNECTING,
    failedStatus("auth failed"),
    STATUS_SENDING,
    sentStatus("sent 1"),
  ]);
  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.equal(node.sentCount, 1);
  assert.equal(node.failedCount, 0);
});

test("smtp send node ignores a deploy result while a send is pending", async () => {
  const verification = deferred();
  const delivery = deferred();
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: { toSource: "str", toValue: "recipient@example.invalid" },
    verifyAccount: () => verification.promise,
    transportFactory() {
      return { sendMail: () => delivery.promise };
    },
  });
  const msg = createImapMessage();
  const sending = runInput(node, msg);

  verification.resolve("connected");
  await Promise.resolve();

  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING]);
  delivery.resolve({ messageId: "message-id" });
  assert.deepEqual((await sending).sentMessages, [[msg, null]]);
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
});

test("smtp send node ignores a deploy result after a completed send", async () => {
  const verification = deferred();
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: { toSource: "str", toValue: "recipient@example.invalid" },
    verifyAccount: () => verification.promise,
    transportFactory() {
      return { async sendMail() { return { messageId: "message-id" }; } };
    },
  });

  await runInput(node, createImapMessage());
  verification.resolve("timeout");
  await Promise.resolve();

  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
  assert.equal(node.failedCount, 0);
});

test("smtp send node ignores a deploy result after message validation fails", async () => {
  const verification = deferred();
  const node = createSendNode({
    accountNode: createAccountNode(),
    verifyAccount: () => verification.promise,
  });
  const msg = createImapMessage();

  assert.deepEqual((await runInput(node, msg)).sentMessages, [[null, msg]]);
  verification.resolve("connected");
  await Promise.resolve();

  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus("failed 1")]);
  assert.equal(node.failedCount, 1);
});

test("closing a sender ignores its pending shared deploy check while another sender receives the result", async () => {
  const verification = deferred();
  const options = {
    accountNode: createAccountNode(),
    verifyAccount: () => verification.promise,
  };
  const closedNode = createSendNode(options);
  const activeNode = createSendNode(options);
  let closeDoneCalls = 0;

  closedNode.handlers.get("close")(false, () => { closeDoneCalls += 1; });
  verification.resolve("connected");
  await Promise.resolve();

  assert.equal(closeDoneCalls, 1);
  assert.deepEqual(closedNode.statusCalls, [STATUS_CONNECTING]);
  assert.deepEqual(activeNode.statusCalls, [STATUS_CONNECTING, STATUS_CONNECTED]);
  assert.deepEqual(closedNode.sentMessages, []);
  assert.deepEqual(activeNode.sentMessages, []);
});

test("a newly deployed sender starts another check and ignores the old instance result", async () => {
  const oldVerification = deferred();
  const newVerification = deferred();
  const oldNode = createSendNode({
    accountNode: createAccountNode(),
    verifyAccount: () => oldVerification.promise,
  });

  oldNode.handlers.get("close")(true, () => {});
  const newNode = createSendNode({
    accountNode: createAccountNode(),
    verifyAccount: () => newVerification.promise,
  });
  newVerification.resolve("connected");
  await Promise.resolve();
  oldVerification.resolve("auth failed");
  await Promise.resolve();

  assert.deepEqual(oldNode.statusCalls, [STATUS_CONNECTING]);
  assert.deepEqual(newNode.statusCalls, [STATUS_CONNECTING, STATUS_CONNECTED]);
});

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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING]);

  resolveSendMail({ messageId: "message-id" });
  const { sentMessages, doneCalls } = await inputPromise;

  assert.deepEqual(sentMessages, [[msg, null]]);
  assert.deepEqual(doneCalls, [undefined]);
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
});

test("smtp send node counts repeated successful sends per node instance", async () => {
  let sendCalls = 0;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      return {
        async sendMail() {
          sendCalls += 1;
          return { messageId: `message-id-${sendCalls}` };
        },
        close() {},
      };
    },
  });

  await runInput(node, createImapMessage());
  await runInput(node, createImapMessage());

  assert.equal(sendCalls, 2);
  assert.deepEqual(node.statusCalls, [
    STATUS_CONNECTING,
    STATUS_SENDING,
    sentStatus("sent 1"),
    STATUS_SENDING,
    sentStatus("sent 2"),
  ]);
  assert.equal(node.sentCount, 2);
  assert.equal(node.failedCount, 0);
});

test("smtp send node shows sent and failed counts after mixed outcomes", async () => {
  let sendCalls = 0;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory() {
      return {
        async sendMail() {
          sendCalls += 1;

          if (sendCalls === 2) {
            throw new Error("SMTP send failed");
          }

          return { messageId: `message-id-${sendCalls}` };
        },
        close() {},
      };
    },
  });
  const first = createImapMessage();
  const second = createImapMessage();
  const third = createImapMessage();

  assert.deepEqual((await runInput(node, first)).sentMessages, [[first, null]]);
  assert.deepEqual((await runInput(node, second)).sentMessages, [[null, second]]);
  assert.deepEqual((await runInput(node, third)).sentMessages, [[third, null]]);

  assert.deepEqual(node.statusCalls, [
    STATUS_CONNECTING,
    STATUS_SENDING,
    sentStatus("sent 1"),
    STATUS_SENDING,
    failedStatus("sent 1, failed 1"),
    STATUS_SENDING,
    sentStatus("sent 2, failed 1"),
  ]);
  assert.equal(node.sentCount, 2);
  assert.equal(node.failedCount, 1);
});

test("smtp send node counts repeated planning failures without sending status", async () => {
  let transportFactoryCalled = false;
  const node = createSendNode({
    accountNode: createAccountNode(),
    config: {
      textSource: "str",
      textValue: "",
      htmlSource: "str",
      htmlValue: "",
    },
    transportFactory() {
      transportFactoryCalled = true;
    },
  });
  const first = createImapMessage();
  const second = createImapMessage();

  assert.deepEqual((await runInput(node, first)).sentMessages, [[null, first]]);
  assert.deepEqual((await runInput(node, second)).sentMessages, [[null, second]]);

  assert.equal(transportFactoryCalled, false);
  assert.deepEqual(node.statusCalls, [
    STATUS_CONNECTING,
    failedStatus("failed 1"),
    failedStatus("failed 2"),
  ]);
  assert.equal(node.sentCount, 0);
  assert.equal(node.failedCount, 2);
});

test("smtp send node keeps status counts isolated per node instance", async () => {
  function transportFactory() {
    return {
      async sendMail() {
        return { messageId: "message-id" };
      },
      close() {},
    };
  }

  const firstNode = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory,
  });
  const secondNode = createSendNode({
    accountNode: createAccountNode(),
    config: {
      toSource: "str",
      toValue: "recipient@example.invalid",
    },
    transportFactory,
  });

  await runInput(firstNode, createImapMessage());
  await runInput(secondNode, createImapMessage());

  assert.deepEqual(firstNode.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
  assert.deepEqual(secondNode.statusCalls, [STATUS_CONNECTING, STATUS_CONNECTED, STATUS_SENDING, sentStatus("sent 1")]);
  assert.equal(firstNode.sentCount, 1);
  assert.equal(secondNode.sentCount, 1);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus("failed 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus("failed 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, failedStatus("failed 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, STATUS_SENDING, sentStatus("sent 1")]);
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
  assert.deepEqual(node.statusCalls, [STATUS_MISSING_ACCOUNT, STATUS_MISSING_ACCOUNT]);
  assert.equal(node.sentCount, 0);
  assert.equal(node.failedCount, 0);
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
  assert.deepEqual(node.statusCalls, [STATUS_CONNECTING, failedStatus("failed 1")]);
  assertStatusTextsDoNotExposeSecrets(node.statusCalls);
  assert.equal(msg.smtpEmail.error, "Factory failed for [redacted]/[redacted]@[redacted]");
});
