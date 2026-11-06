export const LOOPBACK_HOST_VAR = 'MASTRA_AGENTS_LOOPBACK_HOST';
export const BASE_URL_VAR = 'MASTRA_AGENTS_BASE_URL';
export const ISSUER_VAR = 'MASTRA_AGENTS_ISSUER';
export const CLIENT_ID_VAR = 'MASTRA_AGENTS_CLIENT_ID';
export const CLIENT_SECRET_VAR = 'MASTRA_AGENTS_CLIENT_SECRET';

export function resolveLoopbackHost(
  vars: Readonly<Record<string, string | undefined>>,
  fallback: string,
): string {
  const given = vars[LOOPBACK_HOST_VAR];
  return given !== undefined && given !== '' ? given : fallback;
}
