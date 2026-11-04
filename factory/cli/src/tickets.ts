import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Session = { n: number; prompt: string };
export type Anexo = { name: string; sessions: Session[] };

const SESSION_HEADING = /^## SESSION (\d+)\b/;
const FENCE = /^(`{3,})/;

export function parseAnexo(text: string): Session[] {
  const sessions: Session[] = [];
  let current: Session | undefined;
  let fence: string | undefined;
  let body: string[] = [];
  let taken = false;
  for (const line of text.split('\n')) {
    if (fence !== undefined) {
      if (line.trimEnd() === fence) {
        if (current !== undefined) current.prompt = body.join('\n');
        taken = true;
        fence = undefined;
      } else {
        body.push(line);
      }
      continue;
    }
    const heading = SESSION_HEADING.exec(line);
    if (heading !== null) {
      current = { n: Number(heading[1]), prompt: '' };
      sessions.push(current);
      taken = false;
      continue;
    }
    if (current === undefined || taken) continue;
    const open = FENCE.exec(line);
    if (open !== null) {
      fence = open[1];
      body = [];
    }
  }
  return sessions;
}

export function listAnexos(phaseDir: string): Anexo[] {
  return readdirSync(phaseDir)
    .filter((f) => f.endsWith('_TICKETS.md'))
    .sort()
    .map((name) => ({
      name,
      sessions: parseAnexo(readFileSync(join(phaseDir, name), 'utf8')),
    }));
}
