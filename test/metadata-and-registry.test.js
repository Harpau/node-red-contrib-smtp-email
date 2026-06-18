"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

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

test("package.json contains the expected package metadata", () => {
  assert.equal(packageJson.name, "@compeso/node-red-contrib-smtp-email");
  assert.equal(packageJson.version, "0.1.0");
  assert.equal(packageJson.description, "SMTP email send node for Node-RED.");
  assert.equal(packageJson.type, "commonjs");

  assert.equal(packageJson.engines.node, ">=22.0.0");
  assert.equal(packageJson.engines["node-red"], ">=4.0.0");

  assert.equal(
    packageJson.repository.url,
    "git+https://github.com/Harpau/node-red-contrib-smtp-email.git",
  );
  assert.equal(packageJson.homepage, "https://github.com/Harpau/node-red-contrib-smtp-email#readme");
  assert.equal(packageJson.bugs.url, "https://github.com/Harpau/node-red-contrib-smtp-email/issues");
  assert.equal(packageJson.publishConfig.access, "public");

  assert.ok(packageJson.files.includes("nodes"));
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
    const registeredTypes = new Map();
    const createdNodes = [];
    const fakeRed = {
      nodes: {
        createNode(node, config) {
          createdNodes.push({ node, config });
        },
        registerType(type, constructor) {
          registeredTypes.set(type, constructor);
        },
      },
    };

    assert.equal(typeof registerNode, "function");

    registerNode(fakeRed);

    assert.deepEqual([...registeredTypes.keys()], [nodeType]);
    assert.equal(typeof registeredTypes.get(nodeType), "function");

    const NodeConstructor = registeredTypes.get(nodeType);
    const config = { name: "test node" };
    const nodeInstance = new NodeConstructor(config);

    assert.equal(createdNodes.length, 1);
    assert.equal(createdNodes[0].node, nodeInstance);
    assert.equal(createdNodes[0].config, config);
  }
});

test("runtime and editor files use matching Node-RED type names", () => {
  const registryNodes = getRegistryNodes();

  for (const [nodeType, runtimePath] of Object.entries(registryNodes)) {
    const runtimeSource = readProjectFile(runtimePath);
    const htmlPath = getHtmlPathForRuntimePath(runtimePath);
    const htmlSource = readProjectFile(htmlPath);

    const runtimeRegisterPattern = new RegExp(
      `RED\\.nodes\\.registerType\\(\\s*${JSON.stringify(nodeType)}\\s*,`,
    );
    const htmlRegisterPattern = new RegExp(
      `RED\\.nodes\\.registerType\\(\\s*${JSON.stringify(nodeType)}\\s*,`,
    );
    const templatePattern = new RegExp(
      `<script\\s+type="text/html"\\s+data-template-name="${nodeType}">`,
    );
    const helpPattern = new RegExp(
      `<script\\s+type="text/html"\\s+data-help-name="${nodeType}">`,
    );

    assert.match(runtimeSource, runtimeRegisterPattern);
    assert.match(htmlSource, htmlRegisterPattern);
    assert.match(htmlSource, templatePattern);
    assert.match(htmlSource, helpPattern);
  }
});
