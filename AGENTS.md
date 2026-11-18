# AGENTS.md

Guidance for coding agents and contributors working in this repository.

## What this repository is

Navier is a durable agent runtime. Each user message starts a Temporal turn workflow, the worker runs the model and tool calls as activities, and all durable state lives in Postgres. The product is described in [README.md](README.md). The developer documentation is in [docs/](docs/README.md).

Ignore the `factory/` and `phases/` folders. They are out of scope for documentation work and are not the source of truth for behavior.

## Layout

- `README.md`: the project front page.
- `docs/`: the developer documentation. Start with `docs/README.md`.
  - `docs/quickstart.md`: run Navier locally.
  - `docs/architecture.md`: the turn lifecycle, streaming, stop and state.
  - `docs/building-agents.md`: instructions, models, tools, approvals, schedules.
  - `docs/deploying-workers.md`: the worker process, scaling and rollout.
  - `docs/runner/`: existing runner notes.
- `src/`: the source code, when present. Check names against it before documenting them.

## Documentation rules

- **Temporal is the runtime.** Describe turns, retries, timeouts and recovery in Temporal terms. Do not mention any other workflow engine.
- **Verify before you document.** Check every command, route, environment variable and config key against `package.json` and `src/`. If you cannot verify one, say so in the text, and do not present it as working.
- **Mark illustrative code.** Examples whose API is not in the source must carry an `// Illustrative shape.` comment, and the surrounding text must say they are not final.
- **Keep the eve format.** Start each page with a short purpose statement, then concrete steps or examples, then a troubleshooting or next-steps section where it helps.
- **Write for the reader who runs it.** Use exact commands in code blocks, and state the expected result after each step.
- **Link, don't repeat.** The quickstart owns setup. Other pages link to it rather than copying its steps.
- **Headings are sentence case.** Capitalize only the first word and proper nouns.
- **Use relative links** between files in `docs/`.

## Working rules

- Read the relevant doc and the matching source before you edit a page.
- Change only what the task needs. Keep edits focused on the pages you were asked to change.
- Do not commit or push unless the user asks. When you do commit, end the message with:

  ```text
  Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
  ```

- Do not create a branch or push to `main` without the user's explicit instruction.

## When sources disagree

If `docs/` and `src/` disagree, the source wins. Fix the doc, and say in your final message what changed and why.
