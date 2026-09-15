"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(rootDir, "package-lock.json"), "utf8"));

const expectedNodeTypes = ["smtp-email account", "smtp-email send"];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function getRegistryNodes() {
  assert.ok(packageJson["node-red"], "package.json must define a node-red section");
  assert.ok(packageJson["node-red"].nodes, "package.json must define node-red.nodes");
  return packageJson["node-red"].nodes;
}

function getHtmlPathForRuntimePath(runtimePath) {
  assert.equal(path.extname(runtimePath), ".js");
  return runtimePath.replace(/\.js$/, ".html");
}

function getEditorRegistrationSource(htmlSource, nodeType) {
  const scriptPattern = /<script type="text\/javascript">(?<source>[\s\S]*?)<\/script>/;
  const scriptMatch = htmlSource.match(scriptPattern);

  assert.ok(scriptMatch, `editor script for ${nodeType} must exist`);
  assert.match(
    scriptMatch.groups.source,
    new RegExp(`RED\\.nodes\\.registerType\\(\\s*${JSON.stringify(nodeType)}\\s*,`),
  );

  return scriptMatch.groups.source;
}

test("package.json contains the expected package metadata", () => {
  assert.equal(packageJson.name, "@compeso/node-red-contrib-smtp-email");
  assert.match(packageJson.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[""].version, packageJson.version);
  assert.deepEqual(packageLock.packages[""].dependencies, packageJson.dependencies);
  assert.equal(packageJson.license, "MIT");
  assert.equal(packageLock.packages[""].license, packageJson.license);
  assert.match(readProjectFile("LICENSE"), /MIT License/);
  assert.match(readProjectFile("LICENSE"), /Copyright \(c\) 2026 Harald Paulus/);
  assert.equal(packageJson.description, "SMTP email send node for Node-RED.");
  assert.equal(packageJson.type, "commonjs");

  assert.equal(packageJson.engines.node, ">=22.0.0");
  assert.equal(packageJson.engines["node-red"], ">=4.0.0");
  assert.equal(packageJson["node-red"].version, packageJson.engines["node-red"]);

  assert.equal(
    packageJson.repository.url,
    "git+https://github.com/Harpau/node-red-contrib-smtp-email.git",
  );
  assert.equal(packageJson.homepage, "https://github.com/Harpau/node-red-contrib-smtp-email#readme");
  assert.equal(packageJson.bugs.url, "https://github.com/Harpau/node-red-contrib-smtp-email/issues");
  assert.equal(packageJson.publishConfig.access, "public");

  assert.ok(packageJson.files.includes("examples"));
  assert.ok(packageJson.files.includes("nodes"));
  assert.ok(packageJson.files.includes("lib"));
  assert.ok(packageJson.files.includes("README.md"));
});

test("node-red registry exposes exactly the public SMTP node types", () => {
  const registryNodes = getRegistryNodes();

  assert.deepEqual(Object.keys(registryNodes).sort(), expectedNodeTypes.toSorted());

  for (const [nodeType, runtimePath] of Object.entries(registryNodes)) {
    assert.ok(expectedNodeTypes.includes(nodeType));
    assert.equal(path.extname(runtimePath), ".js");
    assert.ok(fs.existsSync(path.join(rootDir, runtimePath)), `${runtimePath} must exist`);

    const htmlPath = getHtmlPathForRuntimePath(runtimePath);
    assert.ok(fs.existsSync(path.join(rootDir, htmlPath)), `${htmlPath} must exist`);
  }
});

test("registered runtime files can be loaded and register their node types", () => {
  const registryNodes = getRegistryNodes();

  for (const [nodeType, runtimePath] of Object.entries(registryNodes)) {
    const registerNode = require(path.join(rootDir, runtimePath));
    const registeredTypes = [];
    const createdNodes = [];
    const fakeRed = {
      nodes: {
        getNode() { return null; },
        createNode(node, config) {
          createdNodes.push({ node, config });
          node.on = function onNodeEvent() {};
        },
        registerType(type, constructor, options) {
          registeredTypes.push({ type, constructor, options });
        },
      },
    };

    assert.equal(typeof registerNode, "function");

    registerNode(fakeRed);

    assert.deepEqual(
      registeredTypes.map((entry) => entry.type),
      [nodeType],
    );
    assert.equal(typeof registeredTypes[0].constructor, "function");

    const NodeConstructor = registeredTypes[0].constructor;
    const config = {
      name: "test node",
      username: "test-user",
      password: "test-password",
    };
    const nodeInstance = new NodeConstructor(config);

    assert.equal(createdNodes.length, 1);
    assert.equal(createdNodes[0].node, nodeInstance);
    assert.equal(createdNodes[0].config, config);
    assert.equal(nodeInstance.username, undefined);
    assert.equal(nodeInstance.password, undefined);
  }
});

test("runtime and editor files use matching Node-RED type names", () => {
  const registryNodes = getRegistryNodes();

  for (const [nodeType, runtimePath] of Object.entries(registryNodes)) {
    const runtimeSource = readProjectFile(runtimePath);
    const htmlPath = getHtmlPathForRuntimePath(runtimePath);
    const htmlSource = readProjectFile(htmlPath);
    const editorRegistrationSource = getEditorRegistrationSource(htmlSource, nodeType);

    const runtimeRegisterPattern = new RegExp(
      `RED\\.nodes\\.registerType\\(\\s*${JSON.stringify(nodeType)}\\s*,`,
    );
    const templatePattern = new RegExp(
      `<script\\s+type="text/html"\\s+data-template-name="${nodeType}">`,
    );
    const helpPattern = new RegExp(
      `<script\\s+type="text/html"\\s+data-help-name="${nodeType}">`,
    );

    assert.match(runtimeSource, runtimeRegisterPattern);
    assert.match(
      editorRegistrationSource,
      new RegExp(`RED\\.nodes\\.registerType\\(\\s*${JSON.stringify(nodeType)}\\s*,`),
    );
    assert.match(htmlSource, templatePattern);
    assert.match(htmlSource, helpPattern);
  }
});

test("smtp account credentials are declared as Node-RED credentials only", () => {
  const registryNodes = getRegistryNodes();
  const runtimePath = registryNodes["smtp-email account"];
  const registerNode = require(path.join(rootDir, runtimePath));
  const registeredTypes = [];
  const fakeRed = {
    nodes: {
      createNode() {},
      registerType(type, constructor, options) {
        registeredTypes.push({ type, constructor, options });
      },
    },
  };

  registerNode(fakeRed);

  assert.equal(registeredTypes.length, 1);
  assert.deepEqual(registeredTypes[0].options, {
    credentials: {
      username: { type: "text" },
      password: { type: "password" },
    },
  });
});

test("smtp send node does not declare credentials", () => {
  const registryNodes = getRegistryNodes();
  const runtimePath = registryNodes["smtp-email send"];
  const registerNode = require(path.join(rootDir, runtimePath));
  const registeredTypes = [];
  const fakeRed = {
    nodes: {
      createNode() {},
      registerType(type, constructor, options) {
        registeredTypes.push({ type, constructor, options });
      },
    },
  };

  registerNode(fakeRed);

  assert.equal(registeredTypes.length, 1);
  assert.equal(registeredTypes[0].options, undefined);
});

test("smtp send editor exposes field source defaults instead of mode defaults", () => {
  const registryNodes = getRegistryNodes();
  const htmlPath = getHtmlPathForRuntimePath(registryNodes["smtp-email send"]);
  const htmlSource = readProjectFile(htmlPath);
  const editorRegistrationSource = getEditorRegistrationSource(htmlSource, "smtp-email send");

  assert.doesNotMatch(editorRegistrationSource, /\bmode\s*:/);
  assert.match(editorRegistrationSource, /toSource:\s*{\s*value:\s*"str"\s*}/);
  assert.match(editorRegistrationSource, /toValue:\s*{\s*value:\s*""\s*,\s*required:\s*true\s*}/);
  assert.match(editorRegistrationSource, /ccSource:\s*{\s*value:\s*"str"\s*}/);
  assert.match(editorRegistrationSource, /bccSource:\s*{\s*value:\s*"str"\s*}/);
  assert.match(editorRegistrationSource, /fromSource:\s*{\s*value:\s*"str"\s*}/);
  assert.match(editorRegistrationSource, /replyToSource:\s*{\s*value:\s*"msg"\s*}/);
  assert.match(editorRegistrationSource, /replyToValue:\s*{\s*value:\s*"email\.header\.reply-to"\s*}/);
  assert.match(editorRegistrationSource, /subjectValue:\s*{\s*value:\s*"email\.topic"\s*}/);
  assert.match(editorRegistrationSource, /textValue:\s*{\s*value:\s*"email\.text"\s*}/);
  assert.match(editorRegistrationSource, /htmlValue:\s*{\s*value:\s*"email\.html"\s*}/);
  assert.match(editorRegistrationSource, /attachmentsValue:\s*{\s*value:\s*"email\.attachments"\s*}/);

  for (const field of ["to", "cc", "bcc", "from", "replyTo", "subject", "text", "html", "attachments"]) {
    assert.match(htmlSource, new RegExp(`id="node-input-${field}Source"`));
    assert.match(htmlSource, new RegExp(`id="node-input-${field}Value"`));
  }
});

test("smtp account editor keeps credentials out of defaults", () => {
  const registryNodes = getRegistryNodes();
  const htmlPath = getHtmlPathForRuntimePath(registryNodes["smtp-email account"]);
  const htmlSource = readProjectFile(htmlPath);
  const editorRegistrationSource = getEditorRegistrationSource(htmlSource, "smtp-email account");

  assert.match(editorRegistrationSource, /credentials:\s*{\s*username:\s*{\s*type:\s*"text"\s*}/);
  assert.match(editorRegistrationSource, /password:\s*{\s*type:\s*"password"\s*}/);
  assert.match(htmlSource, /id="node-config-input-username"/);
  assert.match(htmlSource, /id="node-config-input-password"/);

  const defaultsMatch = editorRegistrationSource.match(/defaults:\s*{(?<defaults>[\s\S]*?)\n    },\n    credentials:/);

  assert.ok(defaultsMatch, "account editor defaults should be followed by credentials");
  assert.doesNotMatch(defaultsMatch.groups.defaults, /\busername\b/);
  assert.doesNotMatch(defaultsMatch.groups.defaults, /\bpassword\b/);
});
