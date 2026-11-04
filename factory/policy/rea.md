# REA

When `tools.rea` is true in `config.yaml`: reverse-engineering evidence from
targets a checkout cannot show. That means closed web apps (Databricks,
Foundry), shipped binaries and packages, and captured traffic. **Read the
skill `rea` before acting.**

This is **not** the indexing note shape ([`indexing.md`](indexing.md),
`paths.index_template`). REA gathers evidence. Local `path:line` still wins
over a REA observation of the same behaviour.

## When

1. **Optional** on any indexing question, with or without a local pin. This
   overrides the skill's "skip for source repositories" line.
2. **Required** when the SESSION or the human says `REA: required`. The note
   then cites at least one Evidence ID, or the report names the blocker
   (no target, provider missing, login needed).
3. With a local pin, REA corroborates runtime behaviour. It does not rank P0.

## How to call

Command line through Bash, pinned:

```
npx -y rea-agents@6.4.0 <command> <args> --format json
```

When `tools.caveman` and the dump is likely > ~400 lines, prefix with
`caveman tools shrink -- `.

`npx -y rea-agents@6.4.0 --help` lists commands; `<command> --help` lists
flags. Do not use the `rea` MCP tools from subagents: they need per-host
registration and the host cuts a tool call at about 60 s. Bump the version
here and in `skills/rea/` together.

| Target | Command |
|--------|---------|
| Pages open in the debug browser | `list-browser-targets http://127.0.0.1:9222` |
| Network calls and JSON shapes while a page is used | `inspect-web-page <endpoint> <targetId> --observation-ms <n> --include-json-body-shapes` |
| Front-end code of a page | `analyze-web-bundle`, `export-web-scripts` |
| Drive a page (clicks, fills, navigation) | `capture-browser-scenario <json-file>` (see Browser) |
| HAR or mitmproxy file | `inspect-web-network-capture <abs-path> har` |
| JavaScript / Electron folder or ASAR | `analyze-javascript-application` |
| Native binary | `inspect`, `function`, `decompile` (needs a provider: `doctor --provider ghidra --json`) |

Paths must be absolute; REA rejects relative ones. A plain data file (a
save file, a dump) often reads better with ordinary file tools than with REA.

## Ask small

1. One target, one function, one endpoint, or one format per call. Never
   "rebuild the app" or "explain everything": a large product's code is many
   times any model's context, and REA does not return a finished copy.
2. Phrase the call as a question with an answer you can check: "which
   request does the Save button send, and which fields does it carry?"
3. Keep replies small. One reply can run to hundreds of thousands of
   characters. Use `--token-limit`, `--filter-output`, summary detail, or
   `inspect-analysis-view` on the retained Evidence ID before asking again.
4. One step at a time. After each step, list what is still unknown.

## Check every answer

1. **Answer key first.** If a pin, a doc, or your own code says what the
   answer is, compare against it. Closed products have no key: cross-check
   with the vendor's docs or API reference (Firecrawl) and say which claims
   stand on REA alone.
2. **Show the evidence.** Every claim cites an Evidence ID and the bytes,
   assembly, request, or field it rests on. A claim with no evidence is a guess.
3. **Read the labels.** Each record has a `confidence` (observed, derived,
   inferred) and a `limitations` list. Check inferred claims hardest, and
   carry the limits into the note.
4. **Names are guesses.** `FUN_004003a0`, `check_password`, or a minified
   `e.t()` are labels from the tool or the model, not facts. Stripped and
   minified targets keep strings, not your names.
5. **Compiled code is not the source.** Optimizers inline, fold, and
   precompute, so a call can vanish and a constant appear. Decompiler output
   is a reconstruction.
6. **Second tool, second phrasing.** Confirm with an independent tool
   (`objdump`, `nm`, browser devtools, the vendor's docs). Ask the same
   question another way; if the answers differ, dig in before writing.
7. The note keeps what REA showed, not what the agent asked.

## Limits

1. **Static before runtime.** Reading a file never runs it. Runtime capture
   runs the target, and REA's process capture "is not a sandbox". Never run
   an untrusted file outside a VM.
2. **Off limits:** copying proprietary software, getting past license
   checks, DRM, or anti-cheat, game cheats, deploying malware, and evading
   an AI provider's safety measures. Indexing ports patterns, never code.
3. **Other people's systems.** A right to inspect a file does not by itself
   cover interacting with someone else's service. Only the human picks a
   third-party target (the SESSION's `REA target:`), on an account they hold
   and under terms they accept. Agents never pick one.
4. **Refusals.** If the model refuses or stops, do not rephrase to get
   around it. Say what the human owns, keep the ask small, or report the stop.

## Browser

1. The debug browser is a separate profile on a loopback port. The human
   starts it and logs in; agents never type credentials:
   `google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.rea-chrome"`.
2. Passive commands (list, inspect, bundle, scripts) are always allowed.
3. Driving the page (`capture-browser-scenario`) is allowed only when the
   SESSION names `REA scratch: <target>` (a catalog, schema, folder, or
   workspace). Every write goes to that target. No scratch named: passive only.
4. Never, even inside scratch: change permissions, users, groups, tokens,
   billing, or workspace settings; touch objects outside scratch.
5. Tell the human to close the debug browser when the session ends. While
   port 9222 is open, any local process can act as the logged-in user.

## Evidence

1. Working files go in `.rea/` at the repo root (git-ignored): raw command
   output, HAR files, exported scripts.
2. The committed evidence is the Evidence record each command prints (one
   JSON object with an `evidence_id`). Save it as
   `<paths.designs>/<unit>/indexing/evidence/<note-stem>/<evidence_id>.json`.
3. Capture shapes, not values. Leave header values and request/response
   bodies off unless the Question needs a value.
4. Before committing, run the secret check. Any hit: do not commit the file;
   keep it in `.rea/` and cite its Evidence ID only.

   ```
   rg -n -i 'bearer [a-z0-9._~+/-]{10,}|dapi[0-9a-f]{8,}|(token|password|secret|session|sid)=[^&"[:space:]]{6,}|"(authorization|cookie|set-cookie|x-csrf-token)"[[:space:]]*:[[:space:]]*"[^"]{8,}"|[a-z0-9._+-]+(@|%40)[a-z0-9-]+\.[a-z.]{2,}' <file>
   ```

   It matches values, not words: REA's own "cookies" disclaimer and a field
   named `is_secret` pass; URL-encoded emails (`%40`) do not. Workspace URLs
   often carry the login email, so expect to redact or keep such records local.

5. Never commit a HAR or mitmproxy file. Never paste header values, cookies,
   or emails into a note.
6. Notes cite the Evidence ID plus the endpoint and field names. Keep the
   record's `confidence` label and name the unknowns. Mark it `live`.

## Install

Skill ships in this kit (`factory/skills/rea`), linked when `tools.rea` is
true. Machine: Node 22.19+ or 24.11+, then
`npx -y rea-agents@6.4.0 doctor --json`. Web, JavaScript, and .NET work need
no engine. Native analysis needs Ghidra 12.1.x and a full JDK 21+ (with
`javac`); setup never installs either, so the human installs them, exports
`GHIDRA_INSTALL_DIR` and `JAVA_HOME`, and checks with
`npx -y rea-agents@6.4.0 doctor --provider ghidra --json`
(<https://rea.tools/get-started/>).
