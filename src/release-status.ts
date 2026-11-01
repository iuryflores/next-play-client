export type ReleaseInfo = {
  releaseDate?: string;
  year?: string;
  unreleased?: boolean;
};
export function upcomingRelease(
  item: ReleaseInfo,
  today = new Date().toISOString().slice(0, 10),
): { date?: string } | null {
  const date = item.releaseDate;
  if (
    date &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  )
    return date > today ? { date } : null;
  if (
    item.unreleased ||
    (/^\d{4}$/.test(item.year || '') &&
      Number(item.year) > Number(today.slice(0, 4)))
  )
    return {};
  return null;
}
