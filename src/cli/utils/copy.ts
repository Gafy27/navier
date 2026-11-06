/** User-visible CLI text from `src/cli/utils` (PD8). */

export const PROMPT_CANCELLED = 'cancelled';
export const PROMPT_NOT_AN_OPTION = 'not an option';

export const USAGE_INVALID_SUB = 'invalid --sub';
export const USAGE_INVALID_TOOL_KEY = 'invalid tool key';
export const USAGE_UNEXPECTED_PRINCIPAL = 'unexpected principal';

export const CREDENTIALS_NOT_JSON = 'credentials file is not valid JSON';
export const CREDENTIALS_BAD_SHAPE = 'credentials file has a bad shape';
export const CREDENTIALS_MODE_TOO_OPEN = 'credentials file mode too open';
export const CREDENTIALS_WRITE_BAD_SHAPE = 'credentials have a bad shape';

export const USAGE_PREFIX = 'usage: ';

export function usageMissingFlag(flag: string): string {
  return `missing --${flag}`;
}
