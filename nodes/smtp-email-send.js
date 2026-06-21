"use strict";

const { MAIL_FIELDS, buildMailOptions } = require("../lib/mail-options");
const { createSmtpTransport, sanitizeErrorMessage } = require("../lib/smtp-transport");

const STATUS = Object.freeze({
  failed: Object.freeze({ fill: "red", shape: "ring", text: "failed" }),
  missingAccount: Object.freeze({ fill: "red", shape: "ring", text: "missing account" }),
  sending: Object.freeze({ fill: "blue", shape: "dot", text: "sending" }),
  sent: Object.freeze({ fill: "green", shape: "dot", text: "sent" }),
});

function getErrorSecrets(account) {
  if (!account || typeof account !== "object") {
    return [];
  }

  const credentials = account.credentials || {};

  return [
    account.host,
    credentials.username,
    credentials.password,
  ];
}

function buildSmtpEmailMetadata(info = {}) {
  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

function closeTransport(transport) {
  if (transport && typeof transport.close === "function") {
    try {
      transport.close();
    } catch {
      // Closing errors must not change the already selected success/failure output.
    }
  }
}

function setStatus(node, statusName) {
  if (typeof node.status === "function") {
    node.status({ ...STATUS[statusName] });
  }
}

function buildCountStatusText(node, statusName) {
  const parts = [];

  if (node.sentCount > 0) {
    parts.push(`sent ${node.sentCount}`);
  }

  if (node.failedCount > 0) {
    parts.push(`failed ${node.failedCount}`);
  }

  return parts.length > 0 ? parts.join(", ") : STATUS[statusName].text;
}

function setCountStatus(node, statusName) {
  if (typeof node.status === "function") {
    node.status({
      fill: STATUS[statusName].fill,
      shape: STATUS[statusName].shape,
      text: buildCountStatusText(node, statusName),
    });
  }
}

function getFieldConfig(config) {
  return MAIL_FIELDS.reduce((fieldConfig, field) => {
    fieldConfig[`${field}Source`] = config[`${field}Source`];
    fieldConfig[`${field}Value`] = config[`${field}Value`];
    return fieldConfig;
  }, {});
}

module.exports = function registerSmtpEmailSendNode(RED, runtimeOptions = {}) {
  function SmtpEmailSendNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    this.name = config.name;
    this.account = config.account;
    this.fieldConfig = getFieldConfig(config);
    this.buildMailOptions = buildMailOptions;
    this.sentCount = 0;
    this.failedCount = 0;

    this.on("input", async function handleInput(msg, send, done) {
      const nodeSend = typeof send === "function" ? send : node.send.bind(node);
      let accountNode;
      let transport;
      let statusName = "failed";

      try {
        accountNode = RED.nodes.getNode(node.account);

        if (!accountNode) {
          statusName = "missingAccount";
          throw new Error("SMTP account is not configured");
        }

        const mailOptions = buildMailOptions({
          msg,
          account: accountNode,
          fieldConfig: node.fieldConfig,
        });
        transport = createSmtpTransport({
          account: accountNode,
          transportFactory: runtimeOptions.transportFactory,
        });
        setStatus(node, "sending");

        const info = await transport.sendMail(mailOptions);

        msg.smtpEmail = buildSmtpEmailMetadata(info);
        node.sentCount += 1;
        setCountStatus(node, "sent");
        nodeSend([msg, null]);
      } catch (error) {
        msg.smtpEmail = {
          error: sanitizeErrorMessage(error, getErrorSecrets(accountNode)),
        };
        if (statusName === "failed") {
          node.failedCount += 1;
          setCountStatus(node, statusName);
        } else {
          setStatus(node, statusName);
        }
        nodeSend([null, msg]);
      } finally {
        closeTransport(transport);
      }

      if (typeof done === "function") {
        done();
      }
    });
  }

  RED.nodes.registerType("smtp-email send", SmtpEmailSendNode);
};
