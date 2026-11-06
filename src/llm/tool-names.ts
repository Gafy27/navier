/** Escapes `_` as `__` and `.` as `_d`, so a key becomes a name providers accept. */
export function encodeToolName(key: string): string {
  return key.replaceAll('_', '__').replaceAll('.', '_d');
}

/** The key behind an encoded name, or `undefined` when `name` is not a code word sequence. */
export function decodeToolName(name: string): string | undefined {
  let key = '';
  for (let i = 0; i < name.length; i += 1) {
    const char = name.charAt(i);
    if (char !== '_') {
      key += char;
      continue;
    }
    const next = name.charAt(i + 1);
    if (next === '_') key += '_';
    else if (next === 'd') key += '.';
    else return undefined;
    i += 1;
  }
  return key;
}
