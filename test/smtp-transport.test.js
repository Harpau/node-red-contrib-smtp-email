"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildTransportOptions,
  createSmtpTransport,
  sanitizeErrorMessage,
} = require("../lib/smtp-transport");

test("buildTransportOptions maps SMTP account settings to nodemailer options", () => {
  const options = buildTransportOptions({
    host: "smtp.example.invalid",
    port: "465",
    secure: "true",
    rejectUnauthorized: "false",
    credentials: {
      username: "test-user",
      password: "test-password",
    },
  });

  assert.deepEqual(options, {
    host: "smtp.example.invalid",
    port: 465,
    secure: true,
    tls: {
      rejectUnauthorized: false,
    },
    auth: {
      user: "test-user",
      pass: "test-password",
    },
  });
});

test("buildTransportOptions omits auth when account credentials are absent", () => {
  const options = buildTransportOptions({
    host: "smtp.example.invalid",
    port: 587,
  });

  assert.equal(options.auth, undefined);
  assert.equal(options.secure, false);
  assert.equal(options.tls.rejectUnauthorized, true);
});

test("buildTransportOptions rejects missing or invalid account settings", () => {
  assert.throws(
    () => buildTransportOptions(null),
    /account must be an object/,
  );
  assert.throws(
    () => buildTransportOptions({ port: 587 }),
    /SMTP account host is required/,
  );
  assert.throws(
    () => buildTransportOptions({ host: "smtp.example.invalid", port: "invalid" }),
    /SMTP account port must be a number between 1 and 65535/,
  );
});

test("createSmtpTransport uses the injected transport factory", () => {
  const expectedTransport = { sendMail() {} };
  let capturedOptions;

  const transport = createSmtpTransport({
    account: {
      host: "smtp.example.invalid",
      port: 587,
    },
    transportFactory(options) {
      capturedOptions = options;
      return expectedTransport;
    },
  });

  assert.equal(transport, expectedTransport);
  assert.deepEqual(capturedOptions, {
    host: "smtp.example.invalid",
    port: 587,
    secure: false,
    tls: {
      rejectUnauthorized: true,
    },
  });
});

test("sanitizeErrorMessage redacts configured secrets", () => {
  const message = sanitizeErrorMessage(
    new Error("Authentication failed for test-user with test-password at smtp.example.invalid"),
    ["test-user", "test-password", "smtp.example.invalid"],
  );

  assert.equal(message, "Authentication failed for [redacted] with [redacted] at [redacted]");
});
