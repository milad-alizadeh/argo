#!/usr/bin/env node
// argo-skill-starter — install a bundle of agent skills (third-party + your own)
// into the current project with one command. A thin resolver over `npx skills add`.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STARTER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const argv = process.argv.slice(2);
const has = (...flags) => flags.some((f) => argv.includes(f));
const dryRun = has("--dry-run", "-n");
const globalOverride = has("--global", "-g");
const projectOverride = has("--project", "-p");

function loadConfig() {
  const path = resolve(STARTER_DIR, "bundle.json");
  try {
    return { path, cfg: JSON.parse(readFileSync(path, "utf8")) };
  } catch (err) {
    console.error(`✗ Could not read bundle.json at ${path}\n  ${err.message}`);
    process.exit(1);
  }
}

// A local "./skills" source must be an absolute path so it resolves from any cwd.
function resolveSource(source) {
  if (source.startsWith(".") || source.startsWith("/")) {
    return isAbsolute(source) ? source : resolve(STARTER_DIR, source);
  }
  return source; // owner/repo, URL, or git spec — passed through to `skills add`
}

function buildArgs(entry, agents, scope) {
  const skills = entry.skills ?? "*";
  const agentList = entry.agents ?? agents;
  const args = ["--yes", "skills", "add", resolveSource(entry.source)];
  args.push("--skill", ...(skills === "*" ? ["*"] : [].concat(skills)));
  if (agentList?.length) args.push("--agent", ...agentList);
  if (scope === "global") args.push("--global");
  args.push("--yes");
  return args;
}

function run(args) {
  console.log(`  $ npx ${args.join(" ")}`);
  if (dryRun) return true;
  return spawnSync("npx", args, { stdio: "inherit", cwd: process.cwd() }).status === 0;
}

const { path, cfg } = loadConfig();
const agents = cfg.agents ?? ["claude-code"];
let scope = cfg.scope ?? "project";
if (globalOverride) scope = "global";
if (projectOverride) scope = "project";

const entries = [...(cfg.bundle ?? []), ...(cfg.mine ?? [])];
if (entries.length === 0) {
  console.error(`✗ No sources listed in ${path} (bundle / mine both empty).`);
  process.exit(1);
}

console.log(`\nargo-skills — ${entries.length} source(s), agents=[${agents.join(", ")}], scope=${scope}${dryRun ? " (dry run)" : ""}`);
console.log(`manifest: ${path}\ninstalling into: ${process.cwd()}\n`);

const failed = [];
for (const entry of entries) {
  const detail = entry.skills && entry.skills !== "*" ? ` [${[].concat(entry.skills).join(", ")}]` : "";
  console.log(`• ${entry.source}${detail}`);
  if (!run(buildArgs(entry, agents, scope))) failed.push(entry.source);
}

console.log("");
if (failed.length) {
  console.error(`✗ ${failed.length} source(s) failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(dryRun ? "✓ Dry run complete — no changes made." : "✓ All skills installed. Any agent in this project can now use them.");
