/** One SSE event: its `id:` line when it has one, and its `data:` lines joined by newlines. */
export interface SseFrame {
  readonly id: string | undefined;
  readonly data: string;
}

/**
 * Reads an SSE body into frames (PD6). Comment lines (`:`) and fields other than
 * `id` and `data` are ignored; a block with no `data:` line is not a frame. Lines
 * end in `\n` or `\r\n`. An unterminated last block is dropped, as the spec says.
 */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let partial = '';
  let id: string | undefined;
  let data: string[] = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      partial += decoder.decode(chunk.value, { stream: true });
      const lines = partial.split('\n');
      partial = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        if (line === '') {
          if (data.length > 0) yield { id, data: data.join('\n') };
          id = undefined;
          data = [];
          continue;
        }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        const value =
          colon === -1 ? '' : line.slice(colon + 1).replace(/^ /u, '');
        if (field === 'data') data.push(value);
        else if (field === 'id') id = value;
      }
    }
  } finally {
    // The caller stopped early or the body failed: release the connection.
    await reader.cancel().catch(() => undefined);
  }
}
