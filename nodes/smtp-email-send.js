"use strict";

module.exports = function registerSmtpEmailSendNode(RED) {
  function SmtpEmailSendNode(config) {
    RED.nodes.createNode(this, config);
  }

  RED.nodes.registerType("smtp-email send", SmtpEmailSendNode);
};
