// src/scripts/session-fake-driver/prove-session-feed.ts
import assert5 from "node:assert/strict";
import { appendFile, mkdir as mkdir2, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path4 from "node:path";
import { _electron as electron } from "playwright-core";

// scripts/acceptance-protocol.mjs
var ACCEPTANCE_ENV = "ARGO_PTY_ACCEPTANCE";

// src/scripts/session-fake-driver/packaged-test-copy.ts
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

// src/scripts/session-fake-driver/packaged-test-copy.ts
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

// src/scripts/session-fake-driver/project-proof-protocol.ts
var PROJECT_PROOF_STORE_ENV = "ARGO_PROJECT_PROOF_STORE";

// src/scripts/session-fake-driver/session-feed-cases.ts
import assert3 from "node:assert/strict";

// src/scripts/session-fake-driver/session-roster-cases.ts
import assert2 from "node:assert/strict";
var listing = { version: 1, type: "session.list", requestId: "list-1" };
var feed = { version: 1, type: "session.feed", requestId: "feed-1", sessionId: "resumeChild" };
async function proveContract(page) {
  const list = await page.evaluate((value) => window.argo.listSessions(value), listing);
  assert2.equal(list.type, "session.listed");
  assert2.deepEqual({ found: list.filesFound, read: list.filesRead }, { found: 7, read: 7 });
  assert2.deepEqual(list.sessions.map((session) => session.id).sort(), [
    "askPending",
    "externalBasic",
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
  const missing = await page.evaluate((value) => window.argo.readSessionFeed(value), {
    ...feed,
    sessionId: "not-a-session"
  });
  assert2.equal(missing.code, "missing-session");
}
function readRoster(page) {
  return page.evaluate(() => {
    const buttons = [...document.querySelectorAll('nav[aria-label="Sessions"] button')];
    return {
      count: buttons.length,
      selected: buttons.filter((button) => button.getAttribute("aria-current") === "true").length,
      reachable: buttons.filter((button) => button.tabIndex === 0).length,
      note: document.querySelector(".cockpit__note")?.textContent ?? "",
      places: [...document.querySelectorAll(".roster__place")].map((place) => place.textContent),
      partial: [...document.querySelectorAll(".roster__partial")].map((note) => note.textContent),
      focused: document.activeElement?.closest("li")?.querySelector(".roster__name")?.textContent,
      stop: document.querySelector('nav[aria-label="Sessions"] button[tabindex="0"]')?.querySelector(".roster__name")?.textContent,
      standing: document.querySelector(".indicator")?.textContent ?? "",
      feedLabel: document.querySelector(".feed__viewport")?.getAttribute("aria-label") ?? ""
    };
  });
}
async function proveRoster(page) {
  await page.waitForSelector('nav[aria-label="Sessions"] button');
  const first = await readRoster(page);
  assert2.equal(first.count, 6);
  assert2.equal(first.selected, 0);
  assert2.equal(first.standing, "Choose a Session to read its history.");
  assert2.equal(first.reachable, 1);
  assert2.equal(first.note.includes("Read 7 transcript files."), true);
  assert2.deepEqual(first.partial, ["continues a Session Argo did not read"]);
  assert2.deepEqual([...new Set(first.places)].sort(), [
    "/Users/x/proj",
    "/Users/x/prose",
    "/Users/x/stranded",
    "/Users/x/tree"
  ]);
  await openSession(page, "Pick the ink", "askPending");
  const chosen = await readRoster(page);
  assert2.equal(chosen.selected, 1);
  assert2.equal(chosen.reachable, 1);
  assert2.equal(chosen.feedLabel, "Session history");
  await page.keyboard.press("ArrowDown");
  const moved = await readRoster(page);
  assert2.equal(moved.reachable, 1);
  assert2.notEqual(moved.focused, undefined);
  assert2.notEqual(moved.focused, "Pick the ink");
  assert2.equal(moved.stop, moved.focused);
  assert2.equal(moved.selected, 1);
  return chosen;
}
async function proveReread(page, transcripts, write) {
  await write(transcripts, ["titledHeadless"], "project-two");
  await page.click('button:has-text("Read again")');
  await page.waitForSelector('button:has-text("The name a person typed")');
  const after = await readRoster(page);
  assert2.equal(after.count, 7);
  assert2.equal(after.note.includes("Read 8 transcript files."), true);
}
async function openSession(page, name, sessionId) {
  await page.click(`button:has-text(${JSON.stringify(name)})`);
  await page.waitForSelector(`.feed__viewport[data-session="${sessionId}"] [data-feed-row]`);
}

// src/scripts/session-fake-driver/session-feed-cases.ts
async function proveFirstOpen(page) {
  await openSession(page, "read this file", "prose");
  const reading = await page.evaluate(() => {
    const viewport = document.querySelector(".feed__viewport");
    const prose = document.querySelector(".feed__viewport .feed-row--prose");
    const range = document.createRange();
    range.selectNodeContents(prose);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    return {
      session: viewport.dataset.session,
      overflows: viewport.scrollHeight > viewport.clientHeight,
      fromTail: viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      userSelect: getComputedStyle(prose).userSelect,
      selected: window.getSelection().toString(),
      measureMs: Number(document.querySelector(".feed").dataset.measureMs),
      settleMs: Number(document.querySelector(".feed").dataset.settleMs)
    };
  });
  assert3.equal(reading.session, "prose");
  assert3.equal(reading.overflows, true);
  assert3.equal(reading.fromTail <= 1, true);
  assert3.notEqual(reading.userSelect, "none");
  assert3.equal(reading.selected.length > 0, true);
  return reading;
}
function watchFrames(page, target) {
  return page.evaluate((name) => new Promise((settle) => {
    const samples = [];
    const read = () => {
      const viewport = document.querySelector(".feed__viewport");
      const row = viewport?.querySelector("[data-feed-row]");
      if (viewport && row) {
        samples.push({
          session: viewport.dataset.session,
          row: row.dataset.feedRow,
          stated: row.style.height
        });
      }
      if (samples.filter((sample) => sample.session === name).length > 8)
        return settle(samples);
      requestAnimationFrame(read);
    };
    read();
  }), target);
}
async function proveNoMislabelledFeed(page) {
  await openSession(page, "Pick the ink", "askPending");
  const watching = watchFrames(page, "unparseableBody");
  await page.click('button:has-text("unparseableBody")');
  const samples = await watching;
  assert3.equal(samples.length > 0, true);
  assert3.deepEqual(samples.filter((sample) => sample.session === "unparseableBody" !== sample.row.startsWith("unreadable:")), []);
}
async function proveNoUnmeasuredRow(page) {
  await openSession(page, "Pick the ink", "askPending");
  const watching = watchFrames(page, "resumeParent");
  await page.click('button:has-text("Start the parent work")');
  const samples = await watching;
  assert3.equal(samples.some((sample) => sample.session === "resumeParent"), true);
  assert3.deepEqual(samples.filter((sample) => sample.stated === ""), []);
}
async function proveRendererAuthority(page, application) {
  await application.evaluate(async ({ BrowserWindow }) => {
    await BrowserWindow.getAllWindows()[0].loadURL("data:text/html,<h1>Untrusted page</h1>");
  });
  await page.waitForFunction(() => typeof window.argo?.listSessions === "function");
  const reply = await page.evaluate((value) => window.argo.listSessions(value), listing);
  assert3.equal(reply.code, "access-denied");
}

// src/scripts/session-fake-driver/session-fixture-files.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path3 from "node:path";
import { fileURLToPath } from "node:url";
var FIXTURES = path3.join(path3.dirname(fileURLToPath(import.meta.url)), "fixtures", "sessions");
async function fixtureLines(name) {
  const text = await readFile(path3.join(FIXTURES, `${name}.jsonl`), "utf8");
  return text.split(`
`).filter((line) => line.length > 0);
}
var PROJECT = "project-one";
function fixturePath(root, name) {
  return path3.join(root, PROJECT, `${name}.jsonl`);
}
async function writeFixtureTree(root, names, directory = PROJECT) {
  const inside = path3.join(root, directory);
  await mkdir(inside, { recursive: true });
  for (const name of names) {
    await writeFile(path3.join(inside, `${name}.jsonl`), `${(await fixtureLines(name)).join(`
`)}
`);
  }
  return root;
}

// src/scripts/session-fake-driver/session-geometry-cases.ts
import assert4 from "node:assert/strict";
async function proveGeometry(page) {
  await page.waitForFunction(() => document.querySelectorAll("[data-feed-row]").length > 0);
  const geometry = await page.evaluate(() => {
    const measured = document.querySelector(".feed__measured");
    const rows = [...measured.querySelectorAll("[data-feed-row]")];
    return {
      containerHeight: measured.getBoundingClientRect().height,
      hidden: getComputedStyle(measured).contentVisibility,
      rowHeights: rows.map((row) => row.offsetHeight)
    };
  });
  assert4.equal(geometry.hidden, "hidden");
  assert4.equal(geometry.containerHeight, 0);
  assert4.equal(geometry.rowHeights.every((height) => height > 0), true);
  return geometry;
}
async function proveDamagedSession(page) {
  await openSession(page, "unparseableBody", "unparseableBody");
  const rows = await page.evaluate(() => [...document.querySelectorAll(".feed__measured [data-feed-row]")].map((row) => ({
    unreadable: row.classList.contains("feed-row--unreadable"),
    height: row.offsetHeight
  })));
  assert4.equal(rows.length, 5);
  assert4.deepEqual([...new Set(rows.map((row) => row.unreadable))], [true]);
  assert4.deepEqual([...new Set(rows.map((row) => row.height))], [36]);
}
async function proveOwnedHeights(page) {
  const rows = await page.evaluate(() => {
    const boxesIn = (root) => [...document.querySelectorAll(`${root} [data-feed-row]`)].map((row) => {
      const box = row.getBoundingClientRect();
      return {
        id: row.dataset.feedRow,
        height: Math.round(box.height * 100) / 100,
        width: Math.round(box.width * 100) / 100,
        stated: row.style.height
      };
    });
    return {
      measured: boxesIn(".feed__measured"),
      shown: boxesIn(".feed__viewport"),
      font: getComputedStyle(document.querySelector(".feed__measured")).font
    };
  });
  assert4.equal(rows.font.length > 0, true);
  assert4.equal(rows.shown.length > 0, true);
  assert4.equal(rows.shown.every((row) => row.stated !== ""), true);
  assert4.deepEqual(rows.shown.map(({ id, height, width }) => ({ id, height, width })), rows.measured.map(({ id, height, width }) => ({ id, height, width })));
  return { rows: rows.shown.length };
}
async function proveRepeatOpening(page) {
  await openSession(page, "Pick the ink", "askPending");
  await openSession(page, "read this file", "prose");
  const again = await page.evaluate(() => ({
    measureMs: Number(document.querySelector(".feed").dataset.measureMs),
    settleMs: Number(document.querySelector(".feed").dataset.settleMs)
  }));
  assert4.deepEqual(again, { measureMs: 0, settleMs: 0 });
}
async function proveGrownSession(page, transcripts, grow) {
  await openSession(page, "carry on from where we left it", "strandedResume");
  const before = await page.evaluate(() => document.querySelectorAll(".feed__viewport [data-feed-row]").length);
  await grow(transcripts);
  await openSession(page, "Refactor the auth module", "externalBasic");
  await openSession(page, "carry on from where we left it", "strandedResume");
  const rows = await page.evaluate(() => [...document.querySelectorAll(".feed__viewport [data-feed-row]")].map((row) => ({
    id: row.dataset.feedRow,
    stated: row.style.height
  })));
  assert4.equal(rows.length, before + 1);
  assert4.deepEqual(rows.filter((row) => row.stated === ""), []);
}

// src/scripts/session-fake-driver/session-proof-protocol.ts
var SESSION_TRANSCRIPTS_ENV = "ARGO_CLAUDE_TRANSCRIPTS";

// src/scripts/session-fake-driver/prove-session-feed.ts
var FIXTURES2 = [
  "resumeParent",
  "resumeChild",
  "externalBasic",
  "unparseableBody",
  "askPending",
  "prose",
  "strandedResume"
];
var shotsIndex = process.argv.indexOf("--shots");
var shots = shotsIndex === -1 ? null : process.argv[shotsIndex + 1] ?? null;
var GROWN_TURN = `${JSON.stringify({
  type: "assistant",
  cwd: "/Users/x/stranded",
  gitBranch: "main",
  timestamp: "2026-08-20T09:30:00.000Z",
  uuid: "sr-asst-2",
  parentUuid: "sr-asst-1",
  message: {
    role: "assistant",
    stop_reason: "end_turn",
    content: [{ type: "text", text: "And one more turn, written while Argo was looking." }]
  }
})}
`;
async function growStranded(transcripts) {
  await appendFile(fixturePath(transcripts, "strandedResume"), GROWN_TURN);
}
async function prepare(root) {
  const application = await packagedTestCopy(root);
  const transcripts = path4.join(root, "transcripts");
  await writeFixtureTree(transcripts, FIXTURES2);
  const userData = path4.join(root, "userData");
  await mkdir2(userData, { recursive: true });
  return { application, transcripts, userData };
}
async function capture(page, application, name) {
  if (shots === null)
    return;
  await mkdir2(shots, { recursive: true });
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
  await page.waitForTimeout(400);
  await page.screenshot({ path: path4.join(shots, name) });
}
var root = await mkdtemp(path4.join(os.tmpdir(), "argo-packaged-session-"));
var application;
var cases = [];
try {
  const fixture = await prepare(root);
  application = await electron.launch({
    executablePath: appExecutable(fixture.application),
    env: {
      ...process.env,
      [SESSION_TRANSCRIPTS_ENV]: fixture.transcripts,
      [PROJECT_PROOF_STORE_ENV]: fixture.userData,
      [ACCEPTANCE_ENV]: "0"
    },
    timeout: 30000
  });
  const page = await application.firstWindow();
  page.setDefaultTimeout(30000);
  await page.waitForFunction(() => typeof window.argo?.listSessions === "function");
  assert5.equal(await application.evaluate(({ app }) => app.isPackaged), true);
  const ran = async (names, prove) => {
    const reading = await prove();
    cases.push(...names);
    return reading;
  };
  await ran(["discovery", "retired-id", "missing-session"], () => proveContract(page));
  const roster = await ran(["roster-focus", "partial-chain"], () => proveRoster(page));
  const geometry = await ran(["settled-geometry"], () => proveGeometry(page));
  await capture(page, application, "roster-and-feed.png");
  await ran(["damaged-session"], () => proveDamagedSession(page));
  await capture(page, application, "damaged-session.png");
  const firstOpen = await ran(["tail-position", "selected-identity", "text-selection"], () => proveFirstOpen(page));
  await capture(page, application, "feed-at-the-tail.png");
  const owned = await ran(["owned-heights", "settled-font"], () => proveOwnedHeights(page));
  await ran(["repeat-opening"], () => proveRepeatOpening(page));
  await ran(["no-mislabelled-feed"], () => proveNoMislabelledFeed(page));
  await ran(["no-unmeasured-row"], () => proveNoUnmeasuredRow(page));
  await ran(["roster-reread"], () => proveReread(page, fixture.transcripts, writeFixtureTree));
  await ran(["grown-session"], () => proveGrownSession(page, fixture.transcripts, growStranded));
  await capture(page, application, "roster-read-again.png");
  await ran(["renderer-authority"], () => proveRendererAuthority(page, application));
  await assertShippedFusesIntact();
  console.log(JSON.stringify({
    ok: true,
    packaged: true,
    sessions: roster.count,
    measuredRows: geometry.rowHeights.length,
    ownedRows: owned.rows,
    measureMs: firstOpen.measureMs,
    settleMs: firstOpen.settleMs,
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
