import { parse } from 'yaml';
import { z } from '../../../index.ts';
import { CliFailure } from '../../utils/failure.ts';

/** Key names a deploy file never holds, at any depth (PD6, § Security). */
export const SECRET_KEY_NAMES: ReadonlySet<string> = new Set([
  'key',
  'secret',
  'token',
  'password',
  'clientSecret',
]);

const ManifestMessage = z.enum({
  notYaml: 'deploy file is not valid YAML',
  badShape: 'deploy file is not an agent manifest',
  secretKey: 'deploy file holds a secret-named key: ',
});

/**
 * The fields deploy acts on (PD6, owner 2026-10-27). `id` is the stable key in
 * `deploy:<space>:<id>`; `tools` are keys, turned into the document's tool refs
 * from the workers' versions.
 */
const DeployFields = z.object({
  id: z.string().min(1),
  space: z.string().min(1),
  tools: z.array(z.string().min(1)),
  published: z.boolean(),
  members: z.array(z.string().min(1)).default([]),
});

const TopLevel = z.record(z.string(), z.unknown());

/** Every other top-level field is the P13.4 document, forwarded as is; the API validates it. */
export type DeployManifest = z.infer<typeof DeployFields> & {
  readonly document: Readonly<Record<string, unknown>>;
};

/** The first secret-named key in a parsed value. Arrays walk by index, so one loop covers both. */
function secretKeyIn(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_NAMES.has(key)) return key;
    const found = secretKeyIn(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Parses one deploy file. No message echoes file text, only a key name (G6). */
export function parseDeployManifest(text: string): DeployManifest {
  let raw: unknown;
  try {
    raw = parse(text);
  } catch {
    throw new CliFailure(ManifestMessage.enum.notYaml);
  }
  const secret = secretKeyIn(raw);
  if (secret !== undefined) {
    throw new CliFailure(`${ManifestMessage.enum.secretKey}${secret}`);
  }
  const top = TopLevel.safeParse(raw);
  const fields = DeployFields.safeParse(raw);
  if (!top.success || !fields.success) {
    throw new CliFailure(ManifestMessage.enum.badShape);
  }
  const document = Object.fromEntries(
    Object.entries(top.data).filter(
      ([field]) => !(field in DeployFields.shape),
    ),
  );
  return { ...fields.data, document };
}
