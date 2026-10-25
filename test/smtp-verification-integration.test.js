"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");
const tls = require("node:tls");
const test = require("node:test");

const { verifySmtpAccount } = require("../lib/smtp-transport");

// Placeholder values used only by the in-process SMTP fixture.
const fixtureCredentials = {
  username: "verification@example.invalid",
  password: "placeholder-password",
};

async function startSmtpFixture(t, { advertiseAuth = true } = {}) {
  const sockets = new Set();
  const commands = [];
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    // TLS mismatch and failed verification intentionally close these sockets.
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 smtp.example.invalid SMTP verification fixture\r\n");
    let pending = "";

    socket.on("data", (chunk) => {
      pending += chunk;
      let boundary;
      while ((boundary = pending.indexOf("\r\n")) !== -1) {
        const line = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        const [command, method, value] = line.split(" ");
        commands.push(command.toUpperCase());

        switch (command.toUpperCase()) {
          case "EHLO":
          case "HELO":
            socket.write(advertiseAuth
              ? "250-smtp.example.invalid\r\n250 AUTH PLAIN\r\n"
              : "250 smtp.example.invalid\r\n");
            break;
          case "AUTH": {
            const expected = `\0${fixtureCredentials.username}\0${fixtureCredentials.password}`;
            const actual = Buffer.from(value || "", "base64").toString("utf8");
            if (advertiseAuth && method === "PLAIN" && actual === expected) {
              socket.write("235 2.7.0 Authentication successful\r\n");
            } else {
              socket.write("535 5.7.8 Authentication failed\r\n");
            }
            break;
          }
          case "QUIT":
            socket.end("221 2.0.0 Closing connection\r\n");
            break;
          default:
            // This fixture never accepts or delivers a message.
            socket.write("502 5.5.1 Command not implemented\r\n");
        }
      }
    });
  });

  t.after(async () => {
    for (const socket of sockets) {
      socket.destroy();
    }
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();
  return {
    commands,
    account: {
      host: address.address,
      port: address.port,
      secure: false,
      rejectUnauthorized: true,
      credentials: { ...fixtureCredentials },
    },
  };
}

// Creating the first secure context in a process loads the certificate store,
// which can take about a second while the test files run in parallel. Pay that
// cost here so the TLS test below measures only the verification itself.
test.before(() => {
  tls.createSecureContext();
});

function assertNoMessageSent(commands) {
  assert.equal(commands.includes("MAIL"), false);
  assert.equal(commands.includes("RCPT"), false);
  assert.equal(commands.includes("DATA"), false);
}

test("real SMTP verification authenticates successfully without sending an email", { timeout: 5000 }, async (t) => {
  const { account, commands } = await startSmtpFixture(t);

  assert.equal(await verifySmtpAccount({ account, timeoutMs: 2000 }), "connected");
  assert.equal(commands.includes("EHLO"), true);
  assert.equal(commands.includes("AUTH"), true);
  assertNoMessageSent(commands);
});

test("real SMTP verification maps rejected credentials to auth failed", { timeout: 5000 }, async (t) => {
  const { account, commands } = await startSmtpFixture(t);
  account.credentials.password = "incorrect-placeholder-password";

  assert.equal(await verifySmtpAccount({ account, timeoutMs: 2000 }), "auth failed");
  assert.equal(commands.includes("AUTH"), true);
  assertNoMessageSent(commands);
});

test("real SMTP verification requires configured authentication when AUTH is not advertised", { timeout: 5000 }, async (t) => {
  const { account, commands } = await startSmtpFixture(t, { advertiseAuth: false });

  assert.equal(await verifySmtpAccount({ account, timeoutMs: 2000 }), "auth failed");
  assert.equal(commands.includes("AUTH"), true);
  assertNoMessageSent(commands);
});

test("real SMTP verification allows a relay without configured credentials", { timeout: 5000 }, async (t) => {
  const { account, commands } = await startSmtpFixture(t, { advertiseAuth: false });
  delete account.credentials;

  assert.equal(await verifySmtpAccount({ account, timeoutMs: 2000 }), "connected");
  assert.equal(commands.includes("AUTH"), false);
  assertNoMessageSent(commands);
});

test("real SMTP verification maps implicit TLS against a plaintext server to TLS error", { timeout: 5000 }, async (t) => {
  const { account, commands } = await startSmtpFixture(t);
  account.secure = true;

  assert.equal(await verifySmtpAccount({ account, timeoutMs: 2000 }), "TLS error");
  assert.equal(commands.includes("AUTH"), false);
  assertNoMessageSent(commands);
});
