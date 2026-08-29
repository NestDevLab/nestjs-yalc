/**
 * Generated REST mappers instantiate DTOs directly. Keep server-owned scope
 * and lifecycle fields out of that copy so REST and GraphQL expose the same
 * public contract.
 */
export function assignOmniPublicDto<T extends object>(
  target: T,
  data: object,
): void {
  const {
    scopeId: _scopeId,
    deletedAt: _deletedAt,
    ...publicData
  } = data as {
    scopeId?: unknown;
    deletedAt?: unknown;
  };
  Object.assign(target, publicData);
  delete (target as { scopeId?: unknown }).scopeId;
  delete (target as { deletedAt?: unknown }).deletedAt;
}
