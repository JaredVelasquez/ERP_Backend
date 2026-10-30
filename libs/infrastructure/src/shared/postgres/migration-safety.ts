export function assertSafeLegacyMigration(
  file: string,
  expectedChecksum: string,
  appliedChecksum: string | undefined,
  hasBusinessTables: boolean,
  isAppendOnlyAddition = false,
): 'already-applied' | 'pending' {
  if (appliedChecksum !== undefined && appliedChecksum !== expectedChecksum) throw new Error(`Migration ${file} changed after application`);
  if (appliedChecksum !== undefined) return 'already-applied';
  if (hasBusinessTables && !isAppendOnlyAddition) throw new Error(`Refusing to recreate schema: ${file} is missing from the existing migration baseline`);
  return 'pending';
}
