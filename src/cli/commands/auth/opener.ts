export interface OpenerCommand {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * The platform opener and its args. No shell: the URL is one argument, so
 * `&` in a query is not parsed by a shell (D1). Windows uses `rundll32`, not
 * `cmd /c start`, for the same reason. `src/cli.ts` spawns it.
 */
export function openerCommand(
  platform: NodeJS.Platform,
  url: string,
): OpenerCommand {
  if (platform === 'darwin') return { command: 'open', args: [url] };
  if (platform === 'win32') {
    return {
      command: 'rundll32',
      args: ['url.dll,FileProtocolHandler', url],
    };
  }
  return { command: 'xdg-open', args: [url] };
}
