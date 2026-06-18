"use strict";

const { buildMailOptions } = require("../lib/mail-options");

module.exports = function registerSmtpEmailSendNode(RED) {
  function SmtpEmailSendNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;
    this.account = config.account;
    this.mode = config.mode || "compose";
    this.buildMailOptions = buildMailOptions;
  }

  RED.nodes.registerType("smtp-email send", SmtpEmailSendNode);
};
