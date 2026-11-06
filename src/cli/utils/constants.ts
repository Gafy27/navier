/** Named values from `src/cli/utils`; not user-facing copy. */

export const CREDENTIALS_FILE_NAME = 'credentials.json';
export const CREDENTIALS_FILE_MODE = 0o600;
export const CREDENTIALS_DIR_MODE = 0o700;
export const CREDENTIALS_GROUP_OTHER_MASK = 0o077;
export const CREDENTIALS_TEMP_PREFIX = '.credentials.';
export const CREDENTIALS_TEMP_SUFFIX = '.tmp';
export const CREDENTIALS_TEMP_RANDOM_BYTES = 8;
export const CREDENTIALS_TEXT_ENCODING = 'utf8';

export const ENOENT = 'ENOENT';

export const PRINCIPAL_MAX_ID_LENGTH = 256;
export const PRINCIPAL_BAD_ID = /[~:#/\s]/u;
export const TOOL_OBJECT_PREFIX = 'tool:';

export const STREAM_FAILURE_NAME = 'StreamFailure';
export const ERROR_LINE_SEP = ': ';

export const EXIT_OK = 0;
export const EXIT_FAIL = 1;
export const EXIT_USAGE = 2;
