export function matchRottenTomatoesMovie<
  T extends { title: string; year: number | null; directors?: string[] },
>(
  results: readonly T[],
  title: string,
  year?: string,
  directors?: readonly string[],
) {
  if (!year || !/^\d{4}$/.test(year)) return null;
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '');
  const expectedDirectors = directors?.map(normalize).filter(Boolean);
  if (expectedDirectors && !expectedDirectors.length) return null;
  const directorsMatch = (names: readonly string[] = []) => {
    if (!expectedDirectors) return true;
    const actual = names.map(normalize);
    // RT's search index abbreviates Christopher Miller in the Lord/Miller duo.
    // Require Phil Lord in both credits to avoid conflating namesake directors.
    const lordMiller =
      expectedDirectors.includes('phillord') && actual.includes('phillord');
    const canonical = (name: string) =>
      lordMiller && name === 'chrismiller' ? 'christophermiller' : name;
    return expectedDirectors.every((name) =>
      actual.some((value) => canonical(value) === canonical(name)),
    );
  };
  const matches = results.filter(
    (result) =>
      result.year === Number(year) &&
      normalize(result.title) === normalize(title) &&
      directorsMatch(result.directors),
  );
  return matches.length === 1 ? matches[0] : null;
}
