"use strict";

module.exports = function registerSmtpEmailAccountNode(RED) {
  function SmtpEmailAccountNode(config) {
    RED.nodes.createNode(this, config);

    this.name = config.name;
    this.host = config.host;
    this.port = config.port;
    this.secure = config.secure;
    this.rejectUnauthorized = config.rejectUnauthorized;
    this.from = config.from;
  }

  RED.nodes.registerType("smtp-email account", SmtpEmailAccountNode, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
};
