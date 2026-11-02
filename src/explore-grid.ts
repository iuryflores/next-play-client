export function missingExploreSlots(count: number, columns: number) {
  const width = Math.max(1, Math.floor(columns));
  return (width - (count % width)) % width;
}

export function explorePageSize(count: number, columns: number, minimum = 12) {
  // O lote inclui o complemento da última fileira, sem esconder cards ou
  // repetir títulos para preencher artificialmente os espaços.
  return minimum + missingExploreSlots(count + minimum, columns);
}
