/** The closed set of reasons a check denies. There is no allow reason. */
export const DenyReason = {
  no_grant: 'no_grant',
  not_visible: 'not_visible',
  unavailable: 'unavailable',
  invalid_scope: 'invalid_scope',
} as const;

export type DenyReason = (typeof DenyReason)[keyof typeof DenyReason];

/** The outcome of a check: allow, or deny with a closed reason. */
export type Decision =
  | { readonly allow: true }
  | { readonly allow: false; readonly reason: DenyReason };
