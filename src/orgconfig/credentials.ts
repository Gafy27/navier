import { sql } from 'kysely';
import { appError, err, ErrorCode, ok } from '../index.ts';
import type { Result } from '../index.ts';
import type { Db, OrgId } from '../db/index.ts';
import { readKeyFile } from './keyfile.ts';
import { unseal } from './seal.ts';

/** What a model call needs. Held for the call only. */
export interface ProviderCredentials {
  readonly adapter: string;
  readonly baseUrl: string;
  readonly apiKey: string;
}

type CredentialRow = {
  adapter: string;
  base_url: string;
  seq: number;
  key_id: string;
  wrapped_key: Buffer;
  wrap_nonce: Buffer;
  data_nonce: Buffer;
  ciphertext: Buffer;
};

/**
 * Newest provider row and newest key row in one query, unsealed with the key
 * file read on this call. Nothing is cached.
 */
export async function readProviderCredentials(
  db: Db,
  org: OrgId,
  provider: string,
): Promise<Result<ProviderCredentials>> {
  const unknown = () =>
    err(appError(ErrorCode.not_found, `provider ${provider} unknown`));
  const { rows } = await sql<CredentialRow>`
    select p.adapter, p.base_url, k.seq, k.key_id, k.wrapped_key,
           k.wrap_nonce, k.data_nonce, k.ciphertext
    from org_provider p
    join org_provider_key k
      on k.org_id = p.org_id and k.provider = p.provider
    where p.org_id = ${org} and p.provider = ${provider}
    order by p.seq desc, k.seq desc
    limit 1
  `.execute(db);
  const row = rows[0];
  if (row === undefined) return unknown();
  const keyFile = readKeyFile();
  if (!keyFile.ok) return keyFile;
  const apiKey = unseal(
    {
      keyId: row.key_id,
      wrappedKey: row.wrapped_key,
      wrapNonce: row.wrap_nonce,
      dataNonce: row.data_nonce,
      ciphertext: row.ciphertext,
    },
    { org, provider, seq: row.seq },
    keyFile.value.keys,
  );
  if (!apiKey.ok) return apiKey;
  return ok({
    adapter: row.adapter,
    baseUrl: row.base_url,
    apiKey: apiKey.value,
  });
}
