// src/scripts/session-proof/prove-project-contract.ts
import assert2 from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path3 from "node:path";
import { _electron as electron } from "playwright-core";

// scripts/acceptance-protocol.mjs
var ACCEPTANCE_ENV = "ARGO_PTY_ACCEPTANCE";

// src/scripts/session-proof/packaged-test-copy.ts
import assert from "node:assert/strict";
import { cp, realpath } from "node:fs/promises";
import path2 from "node:path";
import { FuseV1Options as FuseV1Options2, FuseVersion as FuseVersion2, flipFuses, pathToFuseFile } from "@electron/fuses";

// scripts/fuse-profile.mjs
import { FuseState, FuseV1Options, FuseVersion, getCurrentFuseWire } from "@electron/fuses";
var PRODUCTION_FUSE_PROFILE = {
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
  [FuseV1Options.WasmTrapHandlers]: true
};
var FUSE_NAMES = Object.fromEntries(Object.values(FuseV1Options).filter((value) => typeof value === "number").map((value) => [value, FuseV1Options[value]]));
function isEnabled(state) {
  return state === FuseState.ENABLE;
}
async function readFuseWire(binaryPath) {
  const wire = await getCurrentFuseWire(binaryPath, FuseVersion.V1);
  return Object.entries(PRODUCTION_FUSE_PROFILE).map(([index, expected]) => {
    const state = wire[index];
    const actual = isEnabled(state);
    return {
      fuse: FUSE_NAMES[index],
      expected,
      actual,
      state: FuseState[state] ?? String(state),
      matches: actual === expected
    };
  });
}

// scripts/packaged-app.mjs
import path from "node:path";
var LAUNCH_TIMEOUT_MS = 10 * 60000;
var PACKAGE_TIMEOUT_MS = 15 * 60000;
var APP_NAME = "Argo";
var desktopRoot = path.resolve(import.meta.dirname, "..");
function outputDirectory(arch) {
  return path.join(desktopRoot, "out", `${APP_NAME}-darwin-${arch}`);
}
function packagedApp(arch) {
  return path.join(outputDirectory(arch), `${APP_NAME}.app`);
}

// src/scripts/session-proof/packaged-test-copy.ts
async function packagedTestCopy(root, arch = "arm64") {
  const application = path2.join(root, "Argo.app");
  await cp(packagedApp(arch), application, { recursive: true, verbatimSymlinks: true });
  const copiedRoot = await realpath(application);
  assert.equal((await realpath(pathToFuseFile(application))).startsWith(`${copiedRoot}${path2.sep}`), true);
  await flipFuses(application, {
    version: FuseVersion2.V1,
    ...PRODUCTION_FUSE_PROFILE,
    [FuseV1Options2.EnableNodeCliInspectArguments]: true,
    resetAdHocDarwinSignature: true,
    strictlyRequireAllFuses: true
  });
  const changedFuses = (await readFuseWire(application)).filter((fuse) => !fuse.matches);
  assert.deepEqual(changedFuses.map((fuse) => fuse.fuse), ["EnableNodeCliInspectArguments"]);
  return application;
}
async function assertShippedFusesIntact(arch = "arm64") {
  assert.equal((await readFuseWire(packagedApp(arch))).every((fuse) => fuse.matches), true);
}
function appExecutable(application) {
  return path2.join(application, "Contents", "MacOS", "Argo");
}

// src/scripts/session-proof/project-proof-protocol.ts
var PROJECT_PROOF_STORE_ENV = "ARGO_PROJECT_PROOF_STORE";

// src/scripts/session-proof/prove-project-contract.ts
var request = { version: 1, type: "project.open", requestId: "open-1", projectId: "project-1" };
async function prepare(root) {
  const application = await packagedTestCopy(root);
  const userData = path3.join(root, "userData");
  const projectPath = path3.join(root, "example");
  await mkdir(path3.join(userData, "portable-v1"), { recursive: true });
  await mkdir(projectPath);
  const registryPath = path3.join(userData, "portable-v1", "projects.json");
  await writeFile(registryPath, JSON.stringify({
    version: 1,
    projects: [
      { id: "project-1", path: projectPath, bindings: [{ token: "must-stay-private" }] }
    ]
  }));
  return { application, userData, projectPath, registryPath };
}
async function prove(application, fixture) {
  const page = await application.firstWindow();
  page.setDefaultTimeout(30000);
  await page.waitForFunction(() => typeof window.argo?.openProject === "function");
  assert2.equal(await application.evaluate(({ app }) => app.isPackaged), true);
  assert2.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  assert2.deepEqual(await page.evaluate(() => ({
    node: typeof window.require,
    process: typeof window.process,
    methods: Object.keys(window.argo).sort()
  })), {
    node: "undefined",
    process: "undefined",
    methods: ["listSessions", "openProject", "readSessionFeed", "versions", "zoomFactor"]
  });
  const invoke = (value) => page.evaluate((message) => window.argo.openProject(message), value);
  assert2.deepEqual(await invoke(request), {
    version: 1,
    type: "project.opened",
    requestId: "open-1",
    project: { id: "project-1", name: "example" }
  });
  assert2.equal((await invoke({ ...request, projectId: "missing" })).code, "missing-project");
  await chmod(fixture.projectPath, 0);
  try {
    assert2.equal((await invoke(request)).code, "access-denied");
  } finally {
    await chmod(fixture.projectPath, 448);
  }
  assert2.equal((await invoke({ ...request, path: "/private" })).code, "invalid-request");
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL("data:text/html,<h1>Untrusted page</h1>");
  });
  await page.waitForFunction(() => typeof window.argo?.openProject === "function");
  assert2.equal((await invoke(request)).code, "access-denied");
}
var root = await mkdtemp(path3.join(os.tmpdir(), "argo-packaged-project-"));
var application;
try {
  const fixture = await prepare(root);
  const before = await readFile(fixture.registryPath, "utf8");
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: { ...process.env, [PROJECT_PROOF_STORE_ENV]: fixture.userData, [ACCEPTANCE_ENV]: "0" },
    timeout: 30000
  });
  await prove(application, fixture);
  assert2.equal(await readFile(fixture.registryPath, "utf8"), before);
  await assertShippedFusesIntact();
  console.log(JSON.stringify({
    ok: true,
    packaged: true,
    signed: false,
    profile: "test",
    cases: [
      "success",
      "missing-project",
      "denied-access",
      "invalid-request",
      "renderer-authority",
      "untrusted-page",
      "unchanged-store"
    ]
  }));
} finally {
  try {
    if (application)
      await application.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
