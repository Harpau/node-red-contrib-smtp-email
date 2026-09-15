"use strict";

const nodemailer = require("nodemailer");

const activeVerifications = new WeakMap();
const VERIFY_TIMEOUT_MS = 15000;
const VERIFY_NETWORK_TIMEOUT_MS = 10000;

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function assertObject(value, name) {
  if (value === null || typeof value !== "object") {
    throw new Error(`${name} must be an object`);
  }
}

function normalizePort(port) {
  const numericPort = Number(port);

  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error("SMTP account port must be a number between 1 and 65535");
  }

  return numericPort;
}

function normalizeBoolean(value, defaultValue) {
  if (!hasValue(value)) {
    return defaultValue;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return Boolean(value);
}

function buildTransportOptions(account) {
  assertObject(account, "account");

  if (!hasValue(account.host)) {
    throw new Error("SMTP account host is required");
  }

  const credentials = account.credentials || {};
  const options = {
    host: account.host,
    port: normalizePort(account.port),
    secure: normalizeBoolean(account.secure, false),
    tls: {
      rejectUnauthorized: normalizeBoolean(account.rejectUnauthorized, true),
    },
  };

  if (hasValue(credentials.username) || hasValue(credentials.password)) {
    options.auth = {};

    if (hasValue(credentials.username)) {
      options.auth.user = credentials.username;
    }

    if (hasValue(credentials.password)) {
      options.auth.pass = credentials.password;
    }
  }

  return options;
}

function createSmtpTransport({ account, transportFactory = nodemailer.createTransport } = {}) {
  if (typeof transportFactory !== "function") {
    throw new Error("SMTP transport factory must be a function");
  }

  return transportFactory(buildTransportOptions(account));
}

function verificationErrorStatus(error) {
  // Expose fixed categories only. Server replies can contain secrets.
  const codes = [error?.code, error?.errno, error?.cause?.code];

  if (codes.some((code) => code === "ETIMEDOUT" || code === "ETIMEOUT")) {
    return "timeout";
  }
  if (codes.some((code) => code === "EAUTH" || code === "ENOAUTH")) {
    return "auth failed";
  }
  if (codes.some((code) => ["EDNS", "ENOTFOUND", "EAI_AGAIN"].includes(code))) {
    return "host not found";
  }
  if (codes.some((code) => typeof code === "string" && (
    code === "ETLS" || code.startsWith("ERR_TLS_") || code.startsWith("ERR_SSL_") ||
    code.startsWith("CERT_") || code.startsWith("DEPTH_ZERO_") ||
    code.startsWith("SELF_SIGNED_") || code.startsWith("UNABLE_TO_")
  ))) {
    return "TLS error";
  }
  // Nodemailer replaces some native certificate/OpenSSL codes with ESOCKET.
  // Recognize their descriptions without returning any of that text to users.
  if (error?.code === "ESOCKET" && /certificate|self[- ]signed|\b(?:TLS|SSL)\b/i.test(error.message || "")) {
    return "TLS error";
  }
  return "connection failed";
}

function verifySmtpAccount({
  account,
  transportFactory = nodemailer.createTransport,
  timeoutMs = VERIFY_TIMEOUT_MS,
} = {}) {
  let options;
  try {
    options = buildTransportOptions(account);
    if (options.auth && (!hasValue(options.auth.user) || !hasValue(options.auth.pass))) {
      return Promise.resolve("invalid account");
    }
  } catch {
    return Promise.resolve("invalid account");
  }

  const pending = activeVerifications.get(account);
  if (pending) {
    return pending.result;
  }

  // Use a separate transport: these limits apply only to the start-up probe.
  Object.assign(options, {
    forceAuth: Boolean(options.auth),
    connectionTimeout: VERIFY_NETWORK_TIMEOUT_MS,
    greetingTimeout: VERIFY_NETWORK_TIMEOUT_MS,
    socketTimeout: VERIFY_NETWORK_TIMEOUT_MS,
    dnsTimeout: VERIFY_NETWORK_TIMEOUT_MS,
    logger: false,
    debug: false,
  });

  let settle;
  const result = new Promise((resolve) => { settle = resolve; });
  const entry = { result };
  activeVerifications.set(account, entry);
  const waitMs = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : VERIFY_TIMEOUT_MS;
  const timer = setTimeout(() => settle("timeout"), waitMs);
  let transport;

  Promise.resolve().then(() => {
    transport = transportFactory(options);
    return transport.verify();
  }).then(
    (success) => settle(success === true ? "connected" : "connection failed"),
    (error) => settle(verificationErrorStatus(error)),
  ).finally(() => {
    clearTimeout(timer);
    // close() does not abort a pending verify(). Keep sharing even a timed-out
    // result until the real operation finishes, to avoid duplicate probes.
    activeVerifications.delete(account);
    try {
      if (typeof transport?.close === "function") {
        transport.close();
      }
    } catch {
      // Cleanup must not replace the result of the connection test.
    }
  });

  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeErrorMessage(error, secrets = []) {
  let message = error && error.message ? String(error.message) : "SMTP email send failed";

  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replace(new RegExp(escapeRegExp(secret), "g"), "[redacted]");
    }
  }

  return message || "SMTP email send failed";
}

module.exports = {
  buildTransportOptions,
  createSmtpTransport,
  verifySmtpAccount,
  sanitizeErrorMessage,
};
