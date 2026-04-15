/** Convert a quiz DB row to its public-facing ID (short_id preferred). */
export function toPublicQuizId(row: { short_id?: string | null; id?: string | null }): string {
  return String(row?.short_id ?? row?.id ?? '');
}
