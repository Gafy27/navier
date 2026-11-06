import type { Migration } from '../db/index.ts';
import { up as thread } from './migrations/04_0001_thread.ts';
import { up as message } from './migrations/04_0002_message.ts';
import { up as messageStatus } from './migrations/04_0003_message_status.ts';
import { up as modelResolution } from './migrations/04_0004_model_resolution.ts';
import { up as storedObject } from './migrations/04_0005_stored_object.ts';
import { up as step } from './migrations/04_0006_step.ts';
import { up as action } from './migrations/04_0007_action.ts';
import { up as actionStatus } from './migrations/04_0008_action_status.ts';
import { up as actionOutput } from './migrations/04_0009_action_output.ts';
import { up as stepClaim } from './migrations/04_0010_step_claim.ts';
import { up as stopRequested } from './migrations/04_0011_stop_requested.ts';
import { up as recovery } from './migrations/04_0012_recovery.ts';
import { up as actionBlock } from './migrations/05_0001_action_block.ts';
import { up as messagePause } from './migrations/05_0002_message_pause.ts';
import { up as approvalMemory } from './migrations/05_0003_approval_memory.ts';
import { up as actionDecision } from './migrations/05_0004_action_decision.ts';
import { up as threadTitle } from './migrations/13_0003_thread_title.ts';
import { up as messageRetryKey } from './migrations/13_0004_message_retry_key.ts';
import { up as stream } from './migrations/13_0005_stream.ts';
import { up as streamDeltaSweep } from './migrations/13_0006_stream_delta_sweep.ts';
import { up as messagePauseSnapshot } from './migrations/13_0007_message_pause.ts';
import { up as threadState } from './migrations/13_0007_thread_state.ts';
import { up as pendingMessage } from './migrations/46_0001_pending_message.ts';

/** The runtime unit's migrations, in name order. */
export const runtimeMigrations: readonly Migration[] = [
  { name: '04_0001_thread', up: thread },
  { name: '04_0002_message', up: message },
  { name: '04_0003_message_status', up: messageStatus },
  { name: '04_0004_model_resolution', up: modelResolution },
  { name: '04_0005_stored_object', up: storedObject },
  { name: '04_0006_step', up: step },
  { name: '04_0007_action', up: action },
  { name: '04_0008_action_status', up: actionStatus },
  { name: '04_0009_action_output', up: actionOutput },
  { name: '04_0010_step_claim', up: stepClaim },
  { name: '04_0011_stop_requested', up: stopRequested },
  { name: '04_0012_recovery', up: recovery },
  { name: '05_0001_action_block', up: actionBlock },
  { name: '05_0002_message_pause', up: messagePause },
  { name: '05_0003_approval_memory', up: approvalMemory },
  { name: '05_0004_action_decision', up: actionDecision },
  { name: '13_0003_thread_title', up: threadTitle },
  { name: '13_0004_message_retry_key', up: messageRetryKey },
  { name: '13_0005_stream', up: stream },
  { name: '13_0006_stream_delta_sweep', up: streamDeltaSweep },
  { name: '13_0007_message_pause', up: messagePauseSnapshot },
  { name: '13_0007_thread_state', up: threadState },
  { name: '46_0001_pending_message', up: pendingMessage },
];
