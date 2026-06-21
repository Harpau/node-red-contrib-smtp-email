"use strict";

const MAIL_FIELDS = ["to", "cc", "bcc", "from", "replyTo", "subject", "text", "html", "attachments"];
const DANGEROUS_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);
const DEFAULT_FIELD_CONFIG = Object.freeze({
  to: Object.freeze({ source: "str", value: "" }),
  cc: Object.freeze({ source: "str", value: "" }),
  bcc: Object.freeze({ source: "str", value: "" }),
  from: Object.freeze({ source: "str", value: "" }),
  replyTo: Object.freeze({ source: "msg", value: "email.header.reply-to" }),
  subject: Object.freeze({ source: "msg", value: "email.topic" }),
  text: Object.freeze({ source: "msg", value: "email.text" }),
  html: Object.freeze({ source: "msg", value: "email.html" }),
  attachments: Object.freeze({ source: "msg", value: "email.attachments" }),
});

function isObject(value) {
  return value !== null && typeof value === "object";
}

function assertObject(value, name) {
  if (!isObject(value) || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function getFieldConfig(fieldConfig = {}, field) {
  const defaults = DEFAULT_FIELD_CONFIG[field];
  const source = fieldConfig[`${field}Source`] || defaults.source;
  const configuredValue = fieldConfig[`${field}Value`];
  const hasConfiguredValue =
    Object.prototype.hasOwnProperty.call(fieldConfig, `${field}Value`) &&
    configuredValue !== undefined;
  const value = hasConfiguredValue ? configuredValue : defaults.value;

  return { source, value };
}

function assertSafePath(path) {
  for (const segment of path.split(".")) {
    if (!segment || DANGEROUS_PATH_SEGMENTS.has(segment)) {
      throw new Error(`Unsafe msg path for email field: ${path}`);
    }
  }
}

function readMsgPath(msg, path) {
  const normalizedPath = String(path || "").replace(/^msg\./, "");

  if (!normalizedPath) {
    return undefined;
  }

  assertSafePath(normalizedPath);

  return normalizedPath.split(".").reduce((current, segment) => {
    if (!isObject(current) && typeof current !== "function") {
      return undefined;
    }

    return current[segment];
  }, msg);
}

function normalizeAddressLikeValue(value) {
  if (!hasValue(value)) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const parts = value.map(normalizeAddressLikeValue).filter(hasValue);
    return parts.length > 0 ? parts.join(", ") : undefined;
  }

  if (isObject(value) && typeof value.text === "string") {
    return value.text;
  }

  return undefined;
}

function normalizeStringLikeValue(value) {
  if (!hasValue(value)) {
    return undefined;
  }

  if (typeof value === "string" || Buffer.isBuffer(value)) {
    return value;
  }

  return undefined;
}

function readConfiguredValue({ field, msg, fieldConfig }) {
  const config = getFieldConfig(fieldConfig, field);

  if (config.source === "str") {
    if (field === "attachments" && hasValue(config.value)) {
      throw new Error("Attachments cannot be configured as a fixed string");
    }

    return config.value;
  }

  if (config.source === "msg") {
    return readMsgPath(msg, config.value);
  }

  throw new Error(`Unsupported source for email field ${field}: ${config.source}`);
}

function normalizeMailField(field, value) {
  if (["to", "cc", "bcc", "from", "replyTo"].includes(field)) {
    return normalizeAddressLikeValue(value);
  }

  if (["subject", "text", "html"].includes(field)) {
    return normalizeStringLikeValue(value);
  }

  if (field === "attachments") {
    if (!hasValue(value)) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new Error("Attachments field must resolve to an array");
    }

    return value;
  }

  return value;
}

function buildMailOptions({ msg, account, fieldConfig } = {}) {
  assertObject(msg, "msg");
  assertObject(account, "account");

  const mailOptions = {};

  for (const field of MAIL_FIELDS) {
    const value = normalizeMailField(
      field,
      readConfiguredValue({ field, msg, fieldConfig }),
    );

    if (hasValue(value)) {
      mailOptions[field] = value;
    }
  }

  if (!hasValue(mailOptions.from) && hasValue(account.from)) {
    mailOptions.from = account.from;
  }

  if (!hasValue(mailOptions.to)) {
    throw new Error("Missing configured email recipient");
  }

  if (!hasValue(mailOptions.text) && !hasValue(mailOptions.html)) {
    throw new Error("No email content to send");
  }

  return mailOptions;
}

module.exports = {
  DEFAULT_FIELD_CONFIG,
  MAIL_FIELDS,
  buildMailOptions,
};
