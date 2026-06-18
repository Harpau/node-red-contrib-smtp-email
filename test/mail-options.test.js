"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildMailOptions } = require("../lib/mail-options");

test("buildMailOptions composes mail fields from msg without SMTP access", () => {
  const attachment = { filename: "note.txt", content: "hello" };
  const msg = {
    to: "recipient@example.invalid",
    cc: "copy@example.invalid",
    bcc: "hidden@example.invalid",
    replyTo: "reply@example.invalid",
    subject: "Status update",
    payload: "Plain body",
    html: "<p>HTML body</p>",
    attachments: [attachment],
    imap: { ackToken: { id: "ack-token" } },
  };
  const account = {
    from: "sender@example.invalid",
  };

  const mailOptions = buildMailOptions({ mode: "compose", msg, account });

  assert.deepEqual(mailOptions, {
    to: "recipient@example.invalid",
    cc: "copy@example.invalid",
    bcc: "hidden@example.invalid",
    replyTo: "reply@example.invalid",
    subject: "Status update",
    html: "<p>HTML body</p>",
    attachments: [attachment],
    from: "sender@example.invalid",
    text: "Plain body",
  });
  assert.equal(mailOptions.attachments[0], attachment);
  assert.deepEqual(msg.imap, { ackToken: { id: "ack-token" } });
});

test("buildMailOptions lets msg.from override the account default sender", () => {
  const mailOptions = buildMailOptions({
    mode: "compose",
    msg: {
      to: "recipient@example.invalid",
      from: "override@example.invalid",
      payload: "Body",
    },
    account: {
      from: "default@example.invalid",
    },
  });

  assert.equal(mailOptions.from, "override@example.invalid");
});

test("buildMailOptions accepts buffer payload as text body", () => {
  const payload = Buffer.from("Buffered body");

  const mailOptions = buildMailOptions({
    mode: "compose",
    msg: {
      to: "recipient@example.invalid",
      payload,
    },
    account: {},
  });

  assert.equal(mailOptions.text, payload);
});

test("buildMailOptions does not mutate msg or imap ack tokens", () => {
  const ackToken = { id: "ack-token" };
  const msg = {
    to: "recipient@example.invalid",
    payload: "Body",
    imap: { ackToken },
  };
  const originalMsg = structuredClone(msg);

  buildMailOptions({ mode: "compose", msg, account: {} });

  assert.deepEqual(msg, originalMsg);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("buildMailOptions rejects compose messages without recipients", () => {
  assert.throws(
    () => buildMailOptions({ mode: "compose", msg: { payload: "Body" }, account: {} }),
    /Missing msg\.to for email send/,
  );
});

test("buildMailOptions rejects compose messages without sendable content", () => {
  assert.throws(
    () => buildMailOptions({ mode: "compose", msg: { to: "recipient@example.invalid", payload: { raw: "object" } }, account: {} }),
    /No email content to send/,
  );
});

test("buildMailOptions rejects unsupported modes without exposing message data", () => {
  assert.throws(
    () => buildMailOptions({
      mode: "forward",
      msg: {
        to: "recipient@example.invalid",
        payload: "Body",
      },
      account: {
        from: "sender@example.invalid",
        password: "test-password",
      },
    }),
    /Unsupported smtp email send mode: forward/,
  );
});

test("buildMailOptions rejects invalid inputs with clear errors", () => {
  assert.throws(
    () => buildMailOptions({ mode: "compose", msg: null, account: {} }),
    /msg must be an object/,
  );
  assert.throws(
    () => buildMailOptions({ mode: "compose", msg: { to: "recipient@example.invalid", payload: "Body" }, account: null }),
    /account must be an object/,
  );
});

test("buildMailOptions does not copy credential or transport fields into mail options", () => {
  const mailOptions = buildMailOptions({
    mode: "compose",
    msg: {
      to: "recipient@example.invalid",
      payload: "Body",
      username: "msg-user",
      password: "msg-password",
      user: "msg-user-field",
      pass: "msg-pass-field",
      auth: { user: "msg-auth-user", pass: "msg-auth-pass" },
    },
    account: {
      from: "sender@example.invalid",
      username: "account-user",
      password: "account-password",
      user: "account-user-field",
      pass: "account-pass-field",
      auth: { user: "account-auth-user", pass: "account-auth-pass" },
    },
  });

  assert.equal(mailOptions.username, undefined);
  assert.equal(mailOptions.password, undefined);
  assert.equal(mailOptions.user, undefined);
  assert.equal(mailOptions.pass, undefined);
  assert.equal(mailOptions.auth, undefined);
});
