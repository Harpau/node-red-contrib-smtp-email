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
      mode: "unsupported",
      msg: {
        to: "recipient@example.invalid",
        payload: "Body",
      },
      account: {
        from: "sender@example.invalid",
        password: "test-password",
      },
    }),
    /Unsupported smtp email send mode: unsupported/,
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

test("buildMailOptions forwards structured msg.email content to a new recipient", () => {
  const ackToken = { id: "ack-token" };
  const attachment = { filename: "original.txt", content: "original" };
  const msg = {
    to: "new-recipient@example.invalid",
    imap: { ackToken },
    email: {
      from: "original-sender@example.invalid",
      subject: "Original subject",
      text: "Original text",
      html: "<p>Original HTML</p>",
      attachments: [attachment],
    },
  };

  const mailOptions = buildMailOptions({
    mode: "forward",
    msg,
    account: {
      from: "forwarder@example.invalid",
    },
  });

  assert.deepEqual(mailOptions, {
    to: "new-recipient@example.invalid",
    subject: "Fwd: Original subject",
    from: "forwarder@example.invalid",
    text: "Original text",
    html: "<p>Original HTML</p>",
    attachments: [attachment],
  });
  assert.equal(mailOptions.attachments[0], attachment);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("buildMailOptions lets forward msg fields override recipients and sender fields", () => {
  const mailOptions = buildMailOptions({
    mode: "forward",
    msg: {
      to: "new-recipient@example.invalid",
      cc: "copy@example.invalid",
      bcc: "hidden@example.invalid",
      from: "override-sender@example.invalid",
      replyTo: "reply@example.invalid",
      subject: "Forwarded with context",
      email: {
        subject: "Original subject",
        text: "Original text",
      },
    },
    account: {
      from: "account-sender@example.invalid",
    },
  });

  assert.deepEqual(mailOptions, {
    to: "new-recipient@example.invalid",
    subject: "Forwarded with context",
    cc: "copy@example.invalid",
    bcc: "hidden@example.invalid",
    replyTo: "reply@example.invalid",
    from: "override-sender@example.invalid",
    text: "Original text",
  });
});

test("buildMailOptions uses a generic forward subject when the original subject is missing", () => {
  const mailOptions = buildMailOptions({
    mode: "forward",
    msg: {
      to: "new-recipient@example.invalid",
      email: {
        text: "Original text",
      },
    },
    account: {},
  });

  assert.equal(mailOptions.subject, "Fwd: forwarded email");
});

test("buildMailOptions forwards structured object payload when msg.email is absent", () => {
  const mailOptions = buildMailOptions({
    mode: "forward",
    msg: {
      to: "new-recipient@example.invalid",
      payload: {
        subject: "Payload subject",
        html: "<p>Payload HTML</p>",
      },
    },
    account: {},
  });

  assert.deepEqual(mailOptions, {
    to: "new-recipient@example.invalid",
    subject: "Fwd: Payload subject",
    html: "<p>Payload HTML</p>",
  });
});

test("buildMailOptions rejects forward messages without recipients", () => {
  assert.throws(
    () => buildMailOptions({
      mode: "forward",
      msg: {
        email: { text: "Original text" },
      },
      account: {},
    }),
    /Missing msg\.to for email forward/,
  );
});

test("buildMailOptions rejects forward messages without structured email", () => {
  assert.throws(
    () => buildMailOptions({
      mode: "forward",
      msg: {
        to: "new-recipient@example.invalid",
        payload: "Plain payload is not structured incoming email",
      },
      account: {},
    }),
    /No structured email content to forward/,
  );
});

test("buildMailOptions rejects attachments-only forward messages", () => {
  assert.throws(
    () => buildMailOptions({
      mode: "forward",
      msg: {
        to: "new-recipient@example.invalid",
        email: {
          subject: "Attachments only",
          attachments: [{ filename: "only.txt", content: "attachment" }],
        },
      },
      account: {},
    }),
    /No structured email content to forward/,
  );
});

test("buildMailOptions does not mutate forwarded messages or imap ack tokens", () => {
  const ackToken = { id: "ack-token" };
  const msg = {
    to: "new-recipient@example.invalid",
    imap: { ackToken },
    email: {
      subject: "Original subject",
      text: "Original text",
    },
  };
  const imap = msg.imap;
  const originalMsg = structuredClone(msg);

  buildMailOptions({ mode: "forward", msg, account: {} });

  assert.deepEqual(msg, originalMsg);
  assert.equal(msg.imap, imap);
  assert.equal(msg.imap.ackToken, ackToken);
});

test("buildMailOptions does not copy forward credential or transport fields into mail options", () => {
  const mailOptions = buildMailOptions({
    mode: "forward",
    msg: {
      to: "new-recipient@example.invalid",
      username: "msg-user",
      password: "msg-password",
      user: "msg-user-field",
      pass: "msg-pass-field",
      auth: { user: "msg-auth-user", pass: "msg-auth-pass" },
      email: {
        subject: "Original subject",
        text: "Original text",
        username: "email-user",
        password: "email-password",
        user: "email-user-field",
        pass: "email-pass-field",
        auth: { user: "email-auth-user", pass: "email-auth-pass" },
      },
      payload: {
        subject: "Payload subject",
        text: "Payload text",
        username: "payload-user",
        password: "payload-password",
        user: "payload-user-field",
        pass: "payload-pass-field",
        auth: { user: "payload-auth-user", pass: "payload-auth-pass" },
      },
    },
    account: {
      from: "forwarder@example.invalid",
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
