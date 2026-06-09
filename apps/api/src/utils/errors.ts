export function formatCaughtError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}
