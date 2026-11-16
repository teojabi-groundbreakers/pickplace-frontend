/** Validates the shape of an H10 code without converting or resolving it. */
export function isAdministrativeRegionCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d{10}$/.test(value)
}
