import type { Insertable, Selectable, Transaction } from 'kysely';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import { hasPgCode } from './db.ts';
import type { CoreTables, Tx } from './db.ts';
import type { OrgId } from './org.ts';

/** The table names whose rows carry `org_id` and `seq`. */
export type OrderedTable<DB> = {
  [K in keyof DB & string]: Selectable<DB[K]> extends {
    org_id: OrgId;
    seq: number;
  }
    ? K
    : never;
}[keyof DB & string];

/** One ordered write: the stream is `org` plus `key`; `row` fills the other columns. */
export interface AppendSpec<DB, T extends OrderedTable<DB>> {
  readonly table: T;
  readonly org: OrgId;
  readonly key: Readonly<Partial<Selectable<DB[T]>>>;
  readonly accept: (newest: Selectable<DB[T]> | undefined) => boolean;
  readonly row: (seq: number) => Omit<Insertable<DB[T]>, 'org_id' | 'seq'>;
}

type Loose = Transaction<Record<string, Record<string, unknown>>>;

const UNIQUE_VIOLATION = '23505';

/** Gives a unit a view of the same `Tx` that also knows its own tables. */
export function withTables<T extends { [K in keyof T]: object }>(
  tx: Tx,
): Tx<CoreTables & T> {
  return tx.$extendTables() as unknown as Tx<CoreTables & T>;
}

/**
 * Inserts at the newest `seq` plus one (1 when empty) if `accept` allows.
 * A refused test or a lost race is `aborted`. No lock, no retry.
 */
export async function appendIfNewest<DB, T extends OrderedTable<DB>>(
  tx: Tx<DB>,
  spec: AppendSpec<DB, T>,
): Promise<Result<Selectable<DB[T]>>> {
  const q = tx as unknown as Loose;
  const key = spec.key as Record<string, unknown>;
  const newest = await q
    .selectFrom(spec.table)
    .selectAll()
    .where('org_id', '=', spec.org)
    .where((eb) => eb.and(key))
    .orderBy('seq', 'desc')
    .limit(1)
    .executeTakeFirst();
  if (!spec.accept(newest as Selectable<DB[T]> | undefined)) {
    return err(
      appError(ErrorCode.aborted, 'newest row is not the expected one'),
    );
  }
  const seq = typeof newest?.['seq'] === 'number' ? newest['seq'] + 1 : 1;
  try {
    const row = await q
      .insertInto(spec.table)
      .values({ ...spec.row(seq), ...key, org_id: spec.org, seq })
      .returningAll()
      .executeTakeFirstOrThrow();
    return ok(row as Selectable<DB[T]>);
  } catch (e) {
    if (hasPgCode(e, UNIQUE_VIOLATION)) {
      return err(appError(ErrorCode.aborted, 'lost the race to append', e));
    }
    throw e;
  }
}
