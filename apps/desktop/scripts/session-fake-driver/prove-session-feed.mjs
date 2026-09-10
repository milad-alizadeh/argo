// src/core/sessions/fake-driver/prove-session-feed.ts
import assert4 from "node:assert/strict";
import { mkdir as mkdir2, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path3 from "node:path";
import { _electron as electron } from "playwright-core";

// scripts/acceptance-protocol.mjs
var ACCEPTANCE_ENV = "ARGO_PTY_ACCEPTANCE";

// src/core/desktop-proof/packaged-test-copy.ts
import assert from "node:assert/strict";
import { cp, realpath } from "node:fs/promises";
import path from "node:path";
import process2 from "node:process";
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

// src/core/desktop-proof/packaged-test-copy.ts
function packagedApp(arch) {
  return path.join(process2.cwd(), "out", `Argo-darwin-${arch}`, "Argo.app");
}
async function packagedTestCopy(root, arch = "arm64") {
  const application = path.join(root, "Argo.app");
  await cp(packagedApp(arch), application, { recursive: true, verbatimSymlinks: true });
  const copiedRoot = await realpath(application);
  assert.equal((await realpath(pathToFuseFile(application))).startsWith(`${copiedRoot}${path.sep}`), true);
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
  return path.join(application, "Contents", "MacOS", "Argo");
}

// src/core/projects/fake-driver/project-proof-protocol.ts
var PROJECT_PROOF_STORE_ENV = "ARGO_PROJECT_PROOF_STORE";

// src/core/sessions/proof-protocol.ts
var SESSION_CLAUDE_TRANSCRIPTS_ENV = "ARGO_CLAUDE_TRANSCRIPTS";
var SESSION_CODEX_TRANSCRIPTS_ENV = "ARGO_CODEX_TRANSCRIPTS";

// src/core/sessions/fake-driver/session-feed-cases.ts
import assert3 from "node:assert/strict";

// src/core/sessions/fake-driver/session-roster-cases.ts
import assert2 from "node:assert/strict";
var listing = { version: 1, type: "session.list", requestId: "list-1" };
var feed = { version: 1, type: "session.feed", requestId: "feed-1", sessionId: "resumeChild" };
var codexFeed = {
  version: 1,
  type: "session.feed",
  requestId: "codex-feed-1",
  sessionId: "rollout-codexChild"
};
async function proveContract(page) {
  const list = await page.evaluate((value) => window.argo.listSessions(value), listing);
  assert2.equal(list.type, "session.listed");
  assert2.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 9, read: 9 });
  assert2.deepEqual(list.sessions.map((session) => session.id).sort(), [
    "askPending",
    "externalBasic",
    "rollout-codexParent",
    "prose",
    "resumeParent",
    "strandedResume",
    "unparseableBody"
  ]);
  assert2.deepEqual(list.sessions.filter((session) => session.originUnread).map((session) => session.id), ["strandedResume"]);
  assert2.deepEqual([...new Set(list.sessions.map((session) => session.posture))], ["external"]);
  const read = await page.evaluate((value) => window.argo.readSessionFeed(value), feed);
  assert2.equal(read.chainId, "resumeParent");
  assert2.equal(read.rows.length, 4);
  const codexRead = await page.evaluate((value) => window.argo.readSessionFeed(value), codexFeed);
  assert2.equal(codexRead.chainId, "rollout-codexParent");
  assert2.equal(codexRead.rows.length, 4);
  const missing = await page.evaluate((value) => window.argo.readSessionFeed(value), {
    ...feed,
    sessionId: "not-a-session"
  });
  assert2.equal(missing.code, "missing-session");
}
async function openSession(page, name, sessionId) {
  await page.click(`button:has-text(${JSON.stringify(name)})`);
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`);
}

// src/core/sessions/fake-driver/session-feed-cases.ts
async function proveCodexFeed(page) {
  await openSession(page, "Run Codex check", "rollout-codexParent");
  const reading = await page.evaluate(() => ({
    session: document.querySelector(".feed__viewport")?.getAttribute("data-session"),
    text: document.querySelector(".feed__viewport .feed-row--prose")?.textContent
  }));
  assert3.equal(reading.session, "rollout-codexParent");
  assert3.equal(reading.text?.includes("Run Codex check"), true);
}
async function proveRendererAuthority(page, application) {
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL("data:text/html,<h1>Untrusted page</h1>");
  });
  await page.waitForFunction(() => typeof window.argo?.listSessions === "function");
  const reply = await page.evaluate((value) => window.argo.listSessions(value), listing);
  assert3.equal(reply.code, "access-denied");
}

// src/core/sessions/fake-driver/session-fixture-files.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path2 from "node:path";
import process3 from "node:process";
var FIXTURES = path2.join(process3.cwd(), "src", "agents", "claude", "session-fake-driver", "fixtures", "sessions");
var CODEX_FIXTURES = path2.join(process3.cwd(), "src", "agents", "codex", "session-fake-driver", "fixtures", "sessions");
async function fixtureLines(name, fixtures = FIXTURES) {
  const text = await readFile(path2.join(fixtures, `${name}.jsonl`), "utf8");
  return text.split(`
`).filter((line) => line.length > 0);
}
var PROJECT = "project-one";
async function writeFixtureTree(root, names, options = {}) {
  const { directory = PROJECT, fixtures = FIXTURES } = options;
  const inside = path2.join(root, directory);
  await mkdir(inside, { recursive: true });
  for (const name of names) {
    await writeFile(path2.join(inside, `${name}.jsonl`), `${(await fixtureLines(name, fixtures)).join(`
`)}
`);
  }
  return root;
}

// src/core/sessions/fake-driver/prove-session-feed.ts
var FIXTURES2 = [
  "resumeParent",
  "resumeChild",
  "externalBasic",
  "unparseableBody",
  "askPending",
  "prose",
  "strandedResume"
];
var CODEX_FIXTURE_NAMES = ["rollout-codexParent", "rollout-codexChild"];
var shotsIndex = process.argv.indexOf("--shots");
var shots = shotsIndex === -1 ? null : process.argv[shotsIndex + 1] ?? null;
async function prepare(root) {
  const application = await packagedTestCopy(root);
  const claudeTranscripts = path3.join(root, "claude-transcripts");
  const codexTranscripts = path3.join(root, "codex-transcripts");
  await writeFixtureTree(claudeTranscripts, FIXTURES2);
  await writeFixtureTree(codexTranscripts, CODEX_FIXTURE_NAMES, {
    directory: "2026/09/10",
    fixtures: CODEX_FIXTURES
  });
  const userData = path3.join(root, "userData");
  await mkdir2(userData, { recursive: true });
  return { application, claudeTranscripts, codexTranscripts, userData };
}
async function capture(page, application, name) {
  if (shots === null)
    return;
  await mkdir2(shots, { recursive: true });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path3.join(shots, name) });
}
async function proveSessionsScreen(page, application) {
  await page.click('nav[aria-label="Surfaces"] button:has-text("Sessions")');
  await page.waitForSelector('nav[aria-label="Sessions"] button');
  const empty = await page.evaluate(() => ({
    sessions: document.querySelectorAll('nav[aria-label="Sessions"] button').length,
    message: document.querySelector('[data-component="SessionsEmptyState"] p')?.textContent
  }));
  assert4.equal(empty.sessions, 7);
  assert4.equal(empty.message, "Select a session to read its terminal activity.");
  await capture(page, application, "sessions-empty.png");
  await page.click('button:has-text("askPending")');
  await page.waitForSelector('[aria-label="Session activity"] article');
  const selected = await page.evaluate(() => ({
    activityRows: document.querySelectorAll('[aria-label="Session activity"] article').length,
    empty: document.querySelector('[data-component="SessionsEmptyState"] p')?.textContent ?? ""
  }));
  assert4.equal(selected.activityRows > 0, true);
  assert4.equal(selected.empty, "");
  await capture(page, application, "session-activity.png");
}
var root = await mkdtemp(path3.join(os.tmpdir(), "argo-packaged-session-"));
var application;
var cases = [];
try {
  const fixture = await prepare(root);
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: {
      ...process.env,
      [SESSION_CLAUDE_TRANSCRIPTS_ENV]: fixture.claudeTranscripts,
      [SESSION_CODEX_TRANSCRIPTS_ENV]: fixture.codexTranscripts,
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [ACCEPTANCE_ENV]: "0"
    },
    timeout: 30000
  });
  const page = await application.firstWindow();
  page.setDefaultTimeout(30000);
  await page.waitForFunction(() => typeof window.argo?.listSessions === "function");
  assert4.equal(await application.evaluate(({ app }) => app.isPackaged), true);
  const ran = async (names, prove) => {
    const reading = await prove();
    cases.push(...names);
    return reading;
  };
  await ran(["discovery", "retired-id", "missing-session"], () => proveContract(page));
  await ran(["codex-feed"], () => proveCodexFeed(page));
  await ran(["empty-state", "session-activity"], () => proveSessionsScreen(page, application));
  await ran(["renderer-authority"], () => proveRendererAuthority(page, application));
  await assertShippedFusesIntact();
  console.log(JSON.stringify({
    ok: true,
    packaged: true,
    cases
  }));
} finally {
  try {
    if (application)
      await application.close();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
