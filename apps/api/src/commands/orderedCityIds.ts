export function orderedCityIds(cityIds: readonly string[]): string[] {
  return [...new Set(cityIds)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}
