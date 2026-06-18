"use strict";

const { buildMailOptions } = require("../lib/mail-options");
const { createSmtpTransport, sanitizeErrorMessage } = require("../lib/smtp-transport");

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
    transport.close();
  }
}

module.exports = function registerSmtpEmailSendNode(RED, runtimeOptions = {}) {
  function SmtpEmailSendNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    this.name = config.name;
    this.account = config.account;
    this.mode = config.mode || "compose";
    this.buildMailOptions = buildMailOptions;

    this.on("input", async function handleInput(msg, send, done) {
      const nodeSend = typeof send === "function" ? send : node.send.bind(node);
      let accountNode;

      try {
        accountNode = RED.nodes.getNode(node.account);

        if (!accountNode) {
          throw new Error("SMTP account is not configured");
        }

        const mailOptions = buildMailOptions({
          mode: node.mode,
          msg,
          account: accountNode,
        });
        const transport = createSmtpTransport({
          account: accountNode,
          transportFactory: runtimeOptions.transportFactory,
        });

        try {
          const info = await transport.sendMail(mailOptions);

          msg.smtpEmail = buildSmtpEmailMetadata(info);
          nodeSend([msg, null]);
        } finally {
          closeTransport(transport);
        }
      } catch (error) {
        msg.smtpEmail = {
          error: sanitizeErrorMessage(error, getErrorSecrets(accountNode)),
        };
        nodeSend([null, msg]);
      }

      if (typeof done === "function") {
        done();
      }
    });
  }

  RED.nodes.registerType("smtp-email send", SmtpEmailSendNode);
};
