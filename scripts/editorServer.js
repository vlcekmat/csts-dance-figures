// Vite dev-server plugin for the figure editor (owner only, never in the built site).
//   POST /__edits/save    {id, edit|null}  -> writes src/data/edits.json
//   POST /__edits/publish {message?}       -> commits only src/data/edits.json and pushes
// Accepts requests from this computer only.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const FIELDS = ["desc", "timing", "align", "face", "end", "body", "moving", "rot", "turn", "span", "pos"];
const EDITS = "src/data/edits.json";

/** Keep only the editable fields (never book wording such as alignText). */
function cleanPatch(p) {
  const out = {};
  for (const k of FIELDS) if (p && p[k] !== undefined) out[k] = p[k];
  return out;
}

function cleanRole(r) {
  if (!r || !Array.isArray(r.steps)) return undefined;
  return {
    baseLen: Number(r.baseLen) || 0,
    steps: r.steps.map((s) => {
      const ref = {};
      if (Number.isInteger(s.from)) ref.from = s.from;
      if (s.set) ref.set = cleanPatch(s.set);
      if (Array.isArray(s.unset)) ref.unset = s.unset.filter((k) => FIELDS.includes(k));
      return ref;
    }),
  };
}

function cleanEdit(e) {
  const out = {};
  const man = cleanRole(e.man);
  const lady = cleanRole(e.lady);
  if (man) out.man = man;
  if (lady) out.lady = lady;
  if (typeof e.timing === "string" && e.timing.trim()) out.timing = e.timing.trim();
  if (typeof e.note === "string" && e.note.trim()) out.note = e.note.trim();
  out.updated = new Date().toISOString().slice(0, 10);
  return out;
}

const local = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");

function body(req) {
  return new Promise((ok, fail) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        fail(e);
      }
    });
  });
}

export function figureEditor() {
  let root = process.cwd();
  return {
    name: "figure-editor",
    apply: "serve",
    configResolved(c) {
      root = c.root;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__edits/")) return next();
        const reply = (code, data) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };
        if (req.method !== "POST" || !local(req)) return reply(403, { error: "forbidden" });
        try {
          const file = resolve(root, EDITS);
          if (req.url === "/__edits/save") {
            const { id, edit } = await body(req);
            if (typeof id !== "string" || !/^[a-z]+-\d+$/.test(id)) return reply(400, { error: "bad id" });
            const all = JSON.parse(readFileSync(file, "utf8"));
            if (edit) all[id] = cleanEdit(edit);
            else delete all[id];
            const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
            writeFileSync(file, JSON.stringify(sorted, null, 1) + "\n");
            return reply(200, { ok: true });
          }
          if (req.url === "/__edits/publish") {
            const { message } = await body(req);
            const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
            const leak = readFileSync(file, "utf8");
            if (/alignText|bookNotes|"source": "wdsf"/.test(leak)) return reply(400, { error: "book wording in edits.json" });
            if (git("rev-parse", "--abbrev-ref", "HEAD").trim() !== "main") return reply(400, { error: "not on branch main" });
            if (!git("status", "--porcelain", "--", EDITS).trim()) return reply(200, { ok: true, nothing: true });
            const msg = `Data: hand edits of figures${message ? ` – ${String(message).slice(0, 120)}` : ""}`;
            git("commit", "-m", msg, "--", EDITS);
            git("push", "origin", "HEAD:main");
            return reply(200, { ok: true });
          }
          return reply(404, { error: "unknown" });
        } catch (e) {
          return reply(500, { error: String(e?.stderr || e?.message || e) });
        }
      });
    },
  };
}
