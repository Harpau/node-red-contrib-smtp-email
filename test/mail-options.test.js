"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { DEFAULT_FIELD_CONFIG, buildMailOptions } = require("../lib/mail-options");

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

test("default field config matches safe IMAP-oriented defaults", () => {
  assert.deepEqual(DEFAULT_FIELD_CONFIG.to, { source: "str", value: "" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.cc, { source: "str", value: "" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.bcc, { source: "str", value: "" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.from, { source: "str", value: "" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.replyTo, { source: "msg", value: "email.header.reply-to" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.subject, { source: "msg", value: "email.topic" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.text, { source: "msg", value: "email.text" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.html, { source: "msg", value: "email.html" });
  assert.deepEqual(DEFAULT_FIELD_CONFIG.attachments, { source: "msg", value: "email.attachments" });
});

test("buildMailOptions maps configured msg paths and fixed strings", () => {
  const attachment = { filename: "note.txt", content: "hello" };
  const msg = createImapMessage({ attachments: [attachment] });

  const mailOptions = buildMailOptions({
    msg,
    account: { from: "forwarder@example.invalid" },
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
      ccSource: "msg",
      ccValue: "email.cc",
      bccSource: "msg",
      bccValue: "email.bcc",
    },
  });

  assert.deepEqual(mailOptions, {
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
  assert.equal(mailOptions.attachments[0], attachment);
});

test("buildMailOptions does not use legacy msg.to msg.payload or mode automatically", () => {
  const msg = createImapMessage();

  assert.throws(
    () => buildMailOptions({
      mode: "forward",
      msg,
      account: { from: "forwarder@example.invalid" },
    }),
    /Missing configured email recipient/,
  );
});

test("buildMailOptions falls back to account.from instead of msg.email.from by default", () => {
  const mailOptions = buildMailOptions({
    msg: createImapMessage(),
    account: { from: "forwarder@example.invalid" },
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
    },
  });

  assert.equal(mailOptions.from, "forwarder@example.invalid");
});

test("buildMailOptions can use fixed strings for ordinary mail fields", () => {
  const mailOptions = buildMailOptions({
    msg: createImapMessage(),
    account: {},
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
      subjectSource: "str",
      subjectValue: "Fixed subject",
      textSource: "str",
      textValue: "Fixed text",
      htmlSource: "str",
      htmlValue: "",
      replyToSource: "str",
      replyToValue: "reply@example.invalid",
    },
  });

  assert.deepEqual(mailOptions, {
    to: "new-recipient@example.invalid",
    replyTo: "reply@example.invalid",
    subject: "Fixed subject",
    text: "Fixed text",
  });
});

test("buildMailOptions rejects fixed string attachments", () => {
  assert.throws(
    () => buildMailOptions({
      msg: createImapMessage(),
      account: {},
      fieldConfig: {
        toSource: "str",
        toValue: "new-recipient@example.invalid",
        attachmentsSource: "str",
        attachmentsValue: "not-json-and-not-a-path",
      },
    }),
    /Attachments cannot be configured as a fixed string/,
  );
});

test("buildMailOptions rejects attachment msg paths that do not resolve to arrays", () => {
  assert.throws(
    () => buildMailOptions({
      msg: createImapMessage(),
      account: {},
      fieldConfig: {
        toSource: "str",
        toValue: "new-recipient@example.invalid",
        attachmentsSource: "msg",
        attachmentsValue: "email.text",
      },
    }),
    /Attachments field must resolve to an array/,
  );
});

test("buildMailOptions normalizes reply-to header values", () => {
  const msg = createImapMessage();
  msg.email.header["reply-to"] = [
    { text: "First <first@example.invalid>" },
    "Second <second@example.invalid>",
  ];

  const mailOptions = buildMailOptions({
    msg,
    account: {},
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
    },
  });

  assert.equal(mailOptions.replyTo, "First <first@example.invalid>, Second <second@example.invalid>");
});

test("buildMailOptions omits unusable reply-to objects", () => {
  const msg = createImapMessage();
  msg.email.header["reply-to"] = { value: "not a supported address shape" };

  const mailOptions = buildMailOptions({
    msg,
    account: {},
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
    },
  });

  assert.equal(mailOptions.replyTo, undefined);
});

test("buildMailOptions rejects unsafe msg paths", () => {
  assert.throws(
    () => buildMailOptions({
      msg: createImapMessage(),
      account: {},
      fieldConfig: {
        toSource: "msg",
        toValue: "__proto__.polluted",
      },
    }),
    /Unsafe msg path/,
  );
});

test("buildMailOptions requires recipient and text or html content", () => {
  assert.throws(
    () => buildMailOptions({
      msg: createImapMessage(),
      account: {},
      fieldConfig: {
        toSource: "str",
        toValue: "",
      },
    }),
    /Missing configured email recipient/,
  );

  assert.throws(
    () => buildMailOptions({
      msg: createImapMessage(),
      account: {},
      fieldConfig: {
        toSource: "str",
        toValue: "new-recipient@example.invalid",
        textSource: "str",
        textValue: "",
        htmlSource: "str",
        htmlValue: "",
      },
    }),
    /No email content to send/,
  );
});

test("buildMailOptions does not mutate msg or imap ack tokens", () => {
  const ackToken = { id: "ack-token" };
  const msg = createImapMessage({ ackToken });
  const imap = msg.imap;
  const originalMsg = structuredClone(msg);

  buildMailOptions({
    msg,
    account: { from: "forwarder@example.invalid" },
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
    },
  });

  assert.deepEqual(msg, originalMsg);
  assert.equal(msg.imap, imap);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("buildMailOptions does not copy credential or transport fields into mail options", () => {
  const msg = createImapMessage();
  msg.username = "msg-user";
  msg.password = "msg-password";
  msg.auth = { user: "msg-auth-user", pass: "msg-auth-pass" };

  const mailOptions = buildMailOptions({
    msg,
    account: {
      from: "forwarder@example.invalid",
      username: "account-user",
      password: "account-password",
      auth: { user: "account-auth-user", pass: "account-auth-pass" },
    },
    fieldConfig: {
      toSource: "str",
      toValue: "new-recipient@example.invalid",
    },
  });

  assert.equal(mailOptions.username, undefined);
  assert.equal(mailOptions.password, undefined);
  assert.equal(mailOptions.user, undefined);
  assert.equal(mailOptions.pass, undefined);
  assert.equal(mailOptions.auth, undefined);
});
