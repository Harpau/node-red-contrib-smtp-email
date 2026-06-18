"use strict";

const SAFE_MESSAGE_FIELDS = ["to", "cc", "bcc", "replyTo", "subject", "html", "attachments"];
const STRUCTURED_EMAIL_FIELDS = ["subject", "text", "html", "attachments"];

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

function isStructuredIncomingEmail(value) {
  if (!isPlainObject(value)) {
    return false;
  }

  return STRUCTURED_EMAIL_FIELDS.some((field) => hasValue(value[field]));
}

function getIncomingEmail(msg) {
  if (isStructuredIncomingEmail(msg.email)) {
    return msg.email;
  }

  if (isStructuredIncomingEmail(msg.payload)) {
    return msg.payload;
  }

  throw new Error("No structured email content to forward");
}

function buildForwardMailOptions({ msg, account }) {
  assertPlainObject(msg, "msg");
  assertPlainObject(account, "account");

  if (!hasValue(msg.to)) {
    throw new Error("Missing msg.to for email forward");
  }

  const incomingEmail = getIncomingEmail(msg);
  const mailOptions = {
    to: msg.to,
    subject: hasValue(msg.subject)
      ? msg.subject
      : `Fwd: ${hasValue(incomingEmail.subject) ? incomingEmail.subject : "forwarded email"}`,
  };

  for (const field of ["cc", "bcc", "replyTo"]) {
    if (hasValue(msg[field])) {
      mailOptions[field] = msg[field];
    }
  }

  if (hasValue(msg.from)) {
    mailOptions.from = msg.from;
  } else if (hasValue(account.from)) {
    mailOptions.from = account.from;
  }

  if (hasValue(incomingEmail.text)) {
    mailOptions.text = incomingEmail.text;
  }

  if (hasValue(incomingEmail.html)) {
    mailOptions.html = incomingEmail.html;
  }

  if (hasValue(incomingEmail.attachments)) {
    mailOptions.attachments = incomingEmail.attachments;
  }

  if (!hasValue(mailOptions.text) && !hasValue(mailOptions.html)) {
    throw new Error("No structured email content to forward");
  }

  return mailOptions;
}

function buildMailOptions({ mode, msg, account } = {}) {
  if (mode === "compose") {
    return buildComposeMailOptions({ msg, account });
  }

  if (mode === "forward") {
    return buildForwardMailOptions({ msg, account });
  }

  throw new Error(`Unsupported smtp email send mode: ${mode || "missing"}`);
}

module.exports = {
  buildMailOptions,
};
