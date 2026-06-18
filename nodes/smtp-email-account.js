"use strict";

module.exports = function registerSmtpEmailAccountNode(RED) {
  function SmtpEmailAccountNode(config) {
    RED.nodes.createNode(this, config);
  }

  RED.nodes.registerType("smtp-email account", SmtpEmailAccountNode);
};
