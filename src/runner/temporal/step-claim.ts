import { ok } from '../../index.ts';
import type { Result } from '../../index.ts';
import { withTables } from '../../db/index.ts';
import type { StepGuard } from '../../runtime/model-step.ts';
import type { RuntimeTables } from '../../runtime/tables.ts';

/** Postgres `unique_violation`. */
const PG_UNIQUE = '23505';

/**
 * D3: one `step_claim` row per attempt. A later attempt, or a lost insert,
 * leaves the step `taken`. Temporal redelivers activities, so it needs this.
 */
export const stepClaimGuard: StepGuard = {
  async claim(tx, key, attempt): Promise<Result<'claimed' | 'taken'>> {
    const { org, messageId, stepIndex } = key;
    const q = withTables<RuntimeTables>(tx);
    const newest = await q
      .selectFrom('step_claim')
      .select('attempt')
      .where('org_id', '=', org)
      .where('message_id', '=', messageId)
      .where('step_index', '=', stepIndex)
      .orderBy('attempt', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (newest !== undefined && newest.attempt > attempt) return ok('taken');
    try {
      await q
        .insertInto('step_claim')
        .values({
          org_id: org,
          message_id: messageId,
          step_index: stepIndex,
          attempt,
        })
        .execute();
    } catch (e) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        e.code === PG_UNIQUE
      ) {
        return ok('taken');
      }
      throw e;
    }
    return ok('claimed');
  },
};
