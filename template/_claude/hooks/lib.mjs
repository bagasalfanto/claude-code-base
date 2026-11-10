// Shared helpers for the kit's hooks and scripts. Zero dependencies (Node >= 18).
// Every hook reads one JSON object on stdin and prints at most one JSON object on stdout.
import fs from "node:fs";
import path from "node:path";

// ---------- project root, config, state ----------

export function findRoot(startDir) {
  const env = process.env.CLAUDE_PROJECT_DIR;
  if (env && fs.existsSync(path.join(env, ".claude", "kit.config.json"))) return env;
  let dir = startDir || process.cwd();
  for (let i = 0; i < 40; i++) {
    if (fs.existsSync(path.join(dir, ".claude", "kit.config.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return env || startDir || process.cwd();
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function loadConfig(root) {
  return readJson(path.join(root, ".claude", "kit.config.json"), {});
}

export const stateDir = (root) => path.join(root, ".claude", "state");
export const statePath = (root, name) => path.join(stateDir(root), name);

export function loadScope(root) {
  return readJson(statePath(root, "scope.json"), { status: "none" });
}
export function saveScope(root, f) {
  writeJson(statePath(root, "scope.json"), f);
}

/** In bypassPermissions mode an "ask" may never reach the user, so strict mode turns it into a deny. */
export function strictBypass(input, cfg) {
  return input && input.permission_mode === "bypassPermissions" && cfg.strictInBypass !== false;
}
export function loadEdits(root) {
  return readJson(statePath(root, "edits.json"), { lastCodeEditAt: 0, lastUiEditAt: 0, files: [] });
}
export function loadVerify(root) {
  return readJson(statePath(root, "verify.json"), { lastRunAt: 0, lastPassAt: 0, lastUiPassAt: 0, ok: null, round: 0, scope: null });
}

// ---------- paths and globs ----------

const norm = (p) => String(p || "").replace(/\\/g, "/").replace(/\/+$/, "");
const hasDrive = (p) => /^[a-zA-Z]:\//.test(p);

/** Path of `file` relative to `root`, with forward slashes. Returns null when outside root. */
export function toRel(root, file) {
  let r = norm(root);
  let f = norm(file);
  if (!f) return null;
  if (!hasDrive(f) && !f.startsWith("/")) return f.replace(/^\.\//, ""); // already relative
  const ci = hasDrive(r) || hasDrive(f) || process.platform === "win32";
  const rc = ci ? r.toLowerCase() : r;
  const fc = ci ? f.toLowerCase() : f;
  if (fc === rc) return "";
  if (!fc.startsWith(rc + "/")) return null;
  return f.slice(r.length + 1);
}

const globCache = new Map();
/** Glob -> RegExp. Supports **, *, ?, {a,b}. A pattern without "/" matches at any depth. */
export function globToRegExp(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let g = norm(glob).replace(/^\.\//, "");
  const anyDepth = !g.includes("/");
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        const slash = g[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = g.indexOf("}", i);
      if (end === -1) re += "\\{";
      else {
        re += "(?:" + g.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")).join("|") + ")";
        i = end;
      }
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  const rx = new RegExp("^" + (anyDepth ? "(?:.*/)?" : "") + re + "$", "i");
  globCache.set(glob, rx);
  return rx;
}

/** gitignore-style: later patterns win, "!pattern" re-includes (un-matches) a path. */
export function matchAny(rel, globs) {
  if (rel == null) return false;
  let hit = false;
  for (const g of globs || []) {
    if (g.startsWith("!")) {
      if (hit && globToRegExp(g.slice(1)).test(rel)) hit = false;
    } else if (!hit && globToRegExp(g).test(rel)) hit = true;
  }
  return hit;
}

// ---------- hook I/O ----------

export async function readInput() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function out(obj) {
  if (obj) process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

export function preToolDecision(decision, reason) {
  out({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } });
}

export function addContext(event, text) {
  out({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
}

/** Run a hook body; internal errors never block work (fail-open) but are reported on stderr. */
export async function runHook(fn) {
  try {
    const input = await readInput();
    const root = findRoot(input.cwd);
    await fn(input, root);
    out(null);
  } catch (err) {
    process.stderr.write(`[kit-hook] internal error: ${err && err.message}\n`);
    process.exit(0);
  }
}

// ---------- feature spec parsing ----------

/** Reads a scope card (.scratch/**) and returns the globs listed under the "Scope files" heading. */
export function parseSpecScope(text) {
  const lines = String(text).split(/\r?\n/);
  const globs = [];
  let inScope = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      inScope = /scope\s*files?/i.test(line) && !/out\s*of\s*scope/i.test(line);
      continue;
    }
    if (!inScope) continue;
    const m = line.match(/^\s*[-*]\s+`([^`]+)`/);
    if (m) globs.push(m[1].trim());
  }
  return globs;
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const now = () => Date.now();
