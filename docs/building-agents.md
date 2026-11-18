# Building agents

An agent is a set of instructions, a model, and the tools it can call. This guide shows each part with examples. The examples are the intended shapes. Check them against the repository's `src/` before you copy them, because names may differ.

## Instructions

Instructions are the always-on system prompt. Write them as plain text. Say what the agent is for, what it may do without asking, and what needs approval.

```md
You are the support assistant for the Acme workspace.

- Answer from the ticket database. Quote the ticket ID in every answer.
- Never close a ticket without an approval.
- If you do not know, say so. Do not guess a customer's account details.
```

Keep instructions short. Put long procedures in a separate document and have the agent load it when needed.

## Models

The model is reached through a `ModelAdapter`. An adapter takes the message history and the tool list, streams text and tool calls back, and reports token usage. Navier ships an adapter for each supported provider.

Choose the model in the agent's configuration:

```ts
// Illustrative shape.
export default {
  model: "openai/gpt-5",
  temperature: 0.2,
  maxSteps: 12,
};
```

`maxSteps` caps how many model-and-tool rounds one turn may take. Set it low for chat agents and higher for agents that run long tasks.

## Tools

A tool is a typed function the model can call. Give it a clear description, an input schema, and the authorization action it needs.

```ts
// Illustrative shape.
import { defineTool } from "navier/tools";
import { z } from "zod";

export const lookupTicket = defineTool({
  description: "Find a support ticket by its ID.",
  input: z.object({ ticketId: z.string().uuid() }),
  authz: { action: "ticket.read", resource: (i) => `ticket:${i.ticketId}` },
  async execute({ ticketId }, ctx) {
    const ticket = await ctx.db.tickets.findById(ticketId);
    return ticket ?? { error: "not found" };
  },
});
```

Rules that keep tools safe:

- **Validate input with the schema.** Invalid input never reaches `execute`.
- **Return errors as values.** A thrown error is recorded and shown to the model. A returned `{ error }` is clearer, and the model can recover from it.
- **Make writes idempotent.** A tool can run again after a worker restart. Use the step ID as an idempotency key for external calls.
- **Keep results small.** Return the fields the model needs. Large results make every later step more expensive.

## Approvals

Mark a tool as needing approval when its effect is hard to undo:

```ts
// Illustrative shape.
export const closeTicket = defineTool({
  description: "Close a support ticket.",
  input: z.object({ ticketId: z.string().uuid(), reason: z.string().min(1) }),
  authz: { action: "ticket.close", resource: (i) => `ticket:${i.ticketId}` },
  approval: "required",
  async execute({ ticketId, reason }, ctx) {
    await ctx.db.tickets.update(ticketId, { status: "closed", closeReason: reason });
    return { ticketId, status: "closed" };
  },
});
```

When the model calls this tool, the turn pauses. The approver sees the requested call and the reason, then answers `approve` or `deny`. A denial is returned to the model as the tool result. A missed approval expires, and the turn ends with `approval_expired`.

## Scheduled work

A schedule runs a function on a cron expression. Use it for sweeps, such as closing stale threads or sending a daily summary:

```ts
// Illustrative shape.
import { defineSchedule } from "navier/schedules";

export default defineSchedule({
  cron: "0 * * * *",
  async run({ db }) {
    await db.threads.closeStale({ olderThan: "7 days" });
  },
});
```

Scheduled runs use the same retry and logging rules as turns.

## Test an agent before you deploy it

1. Run the worker and API locally, as in the [quickstart](quickstart.md).
2. Send a message that should use each tool, and check the tool rows in Postgres.
3. Send a message that should need approval, and check that the turn pauses.
4. Stop a turn during a long reply, and check that the stream ends and the message is marked stopped.
5. Restart the worker during a turn, and check that the turn finishes after it comes back.

Step 5 is the most important. It is the case that durable turns exist to handle.
