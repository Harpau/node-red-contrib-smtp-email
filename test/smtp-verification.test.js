"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { setImmediate: nextTurn } = require("node:timers/promises");
const { verifySmtpAccount } = require("../lib/smtp-transport");

function account(overrides = {}) {
  return {
    host: "smtp.example.invalid",
    port: 465,
    secure: true,
    rejectUnauthorized: true,
    credentials: { username: "test-user", password: "test-password" },
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("verification checks account credentials with a separate bounded transport", async () => {
  let options;
  let closes = 0;
  let sends = 0;
  const result = await verifySmtpAccount({
    account: account(),
    transportFactory(value) {
      options = value;
      return {
        async verify() { return true; },
        sendMail() { sends += 1; },
        close() { closes += 1; },
      };
    },
  });
  await nextTurn();
  assert.equal(result, "connected");
  assert.equal(sends, 0);
  assert.equal(closes, 1);
  assert.deepEqual(options, {
    host: "smtp.example.invalid", port: 465, secure: true,
    tls: { rejectUnauthorized: true },
    auth: { user: "test-user", pass: "test-password" },
    forceAuth: true,
    connectionTimeout: 10000, greetingTimeout: 10000,
    socketTimeout: 10000, dnsTimeout: 10000,
    logger: false, debug: false,
  });
});

test("verification supports a relay without credentials and honors TLS settings", async () => {
  let options;
  assert.equal(await verifySmtpAccount({
    account: account({ credentials: {}, port: 587, secure: false, rejectUnauthorized: false }),
    transportFactory(value) {
      options = value;
      return { async verify() { return true; } };
    },
  }), "connected");
  assert.equal(options.auth, undefined);
  assert.equal(options.forceAuth, false);
  assert.equal(options.secure, false);
  assert.equal(options.tls.rejectUnauthorized, false);
});

test("invalid accounts fail before any network operation", async () => {
  for (const value of [null, undefined, {}, account({ host: "" }), account({ port: "invalid" }),
    account({ credentials: { username: "test-user" } }),
    account({ credentials: { password: "test-password" } })]) {
    let creates = 0;
    assert.equal(await verifySmtpAccount({
      account: value, transportFactory() { creates += 1; },
    }), "invalid account");
    assert.equal(creates, 0);
  }
});

test("verification uses safe error categories instead of server error text", async () => {
  const cases = [
    [{ code: "EAUTH" }, "auth failed"],
    [{ code: "ENOAUTH" }, "auth failed"],
    [{ code: "EDNS" }, "host not found"],
    [{ code: "ENOTFOUND" }, "host not found"],
    [{ code: "EAI_AGAIN" }, "host not found"],
    [{ code: "ETIMEDOUT" }, "timeout"],
    [{ code: "ETLS" }, "TLS error"],
    [{ code: "ESOCKET", errno: "CERT_HAS_EXPIRED" }, "TLS error"],
    [{ code: "ESOCKET", cause: { code: "ERR_TLS_CERT_ALTNAME_INVALID" } }, "TLS error"],
    [{ code: "ESOCKET", message: "self-signed certificate" }, "TLS error"],
    [{ code: "ESOCKET", message: "certificate has expired" }, "TLS error"],
    [{ code: "ESOCKET", message: "SSL routines:wrong version number" }, "TLS error"],
    [{ code: "DEPTH_ZERO_SELF_SIGNED_CERT" }, "TLS error"],
    [{ code: "ERR_SSL_WRONG_VERSION_NUMBER" }, "TLS error"],
    [{ code: "ECONNREFUSED" }, "connection failed"],
    [{ code: "ECONNECTION" }, "connection failed"],
    [{}, "connection failed"],
  ];
  for (const [details, expected] of cases) {
    let closed = false;
    const error = Object.assign(new Error("test-user/test-password@smtp.example.invalid"), details);
    const result = await verifySmtpAccount({
      account: account(),
      transportFactory() {
        return { verify() { throw error; }, close() { closed = true; } };
      },
    });
    await nextTurn();
    assert.equal(result, expected);
    assert.equal(closed, true);
  }
});

test("factory and cleanup failures cannot escape or replace a verification result", async () => {
  assert.equal(await verifySmtpAccount({
    account: account(), transportFactory() { throw new Error("test-password"); },
  }), "connection failed");
  assert.equal(await verifySmtpAccount({
    account: account(),
    transportFactory() {
      return { async verify() { return true; }, close() { throw new Error("test-password"); } };
    },
  }), "connected");
  assert.equal(await verifySmtpAccount({
    account: account(), transportFactory() { return { async verify() { return false; } }; },
  }), "connection failed");
  await nextTurn();
});

test("concurrent probes share an account but later starts check again", async () => {
  const value = account();
  const check = deferred();
  let creates = 0;
  const options = {
    account: value,
    transportFactory() { creates += 1; return { verify() { return check.promise; } }; },
  };
  const first = verifySmtpAccount(options);
  const second = verifySmtpAccount(options);
  assert.equal(first, second);
  await nextTurn();
  assert.equal(creates, 1);
  check.resolve(true);
  assert.equal(await first, "connected");
  await nextTurn();
  assert.equal(await verifySmtpAccount(options), "connected");
  assert.equal(creates, 2);
});

test("a timed-out probe remains shared until the real operation ends", async () => {
  const value = account();
  const check = deferred();
  let creates = 0;
  let closes = 0;
  const options = {
    account: value, timeoutMs: 5,
    transportFactory() {
      creates += 1;
      return { verify() { return check.promise; }, close() { closes += 1; } };
    },
  };
  const first = verifySmtpAccount(options);
  assert.equal(await first, "timeout");
  assert.equal(verifySmtpAccount(options), first);
  assert.equal(creates, 1);
  assert.equal(closes, 0);
  check.reject(new Error("late test-password"));
  await nextTurn();
  assert.equal(await first, "timeout");
  assert.equal(closes, 1);
  assert.equal(await verifySmtpAccount({
    account: value, transportFactory() { return { async verify() { return true; } }; },
  }), "connected");
});

test("different account instances never share credentials or results", async () => {
  const firstCheck = deferred();
  const first = verifySmtpAccount({
    account: account(), transportFactory() { return { verify() { return firstCheck.promise; } }; },
  });
  let password;
  const second = verifySmtpAccount({
    account: account({ credentials: { username: "test-user", password: "changed-test-password" } }),
    transportFactory(options) {
      password = options.auth.pass;
      return { async verify() { return true; } };
    },
  });
  assert.equal(await second, "connected");
  assert.equal(password, "changed-test-password");
  firstCheck.resolve(true);
  assert.equal(await first, "connected");
});
