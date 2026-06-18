"use strict";

const SAFE_MESSAGE_FIELDS = ["to", "cc", "bcc", "replyTo", "subject", "html", "attachments"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Buffer.isBuffer(value) && !Array.isArray(value);
}

function assertPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function buildComposeMailOptions({ msg, account }) {
  assertPlainObject(msg, "msg");
  assertPlainObject(account, "account");

  if (!hasValue(msg.to)) {
    throw new Error("Missing msg.to for email send");
  }

  const mailOptions = {
    to: msg.to,
  };

  for (const field of SAFE_MESSAGE_FIELDS) {
    if (field !== "to" && hasValue(msg[field])) {
      mailOptions[field] = msg[field];
    }
  }

  if (hasValue(msg.from)) {
    mailOptions.from = msg.from;
  } else if (hasValue(account.from)) {
    mailOptions.from = account.from;
  }

  if (typeof msg.payload === "string" || Buffer.isBuffer(msg.payload)) {
    mailOptions.text = msg.payload;
  }

  if (!hasValue(mailOptions.text) && !hasValue(mailOptions.html)) {
    throw new Error("No email content to send");
  }

  return mailOptions;
}

function buildMailOptions({ mode, msg, account } = {}) {
  if (mode !== "compose") {
    throw new Error(`Unsupported smtp email send mode: ${mode || "missing"}`);
  }

  return buildComposeMailOptions({ msg, account });
}

module.exports = {
  buildMailOptions,
};
