"use strict";

const nodemailer = require("nodemailer");

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
  sanitizeErrorMessage,
};
