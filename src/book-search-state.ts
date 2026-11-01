export type BookSearchField = 'title' | 'author' | 'isbn';
export type BookSearchMode = 'suggestions' | 'search' | 'idle';

// ISBN incompleto não consome cota nem produz erro a cada tecla.
export function bookSearchMode(
  query: string,
  field: BookSearchField,
): BookSearchMode {
  const text = query.trim();
  if (!text) return 'suggestions';
  if (field !== 'isbn') return text.length >= 2 ? 'search' : 'idle';
  const isbn = text.replace(/[\s-]/g, '').toUpperCase();
  if (
    /^\d{13}$/.test(isbn) &&
    isbn.split('').reduce((sum, n, i) => sum + Number(n) * (i % 2 ? 3 : 1), 0) %
      10 ===
      0
  )
    return 'search';
  if (
    /^\d{9}[\dX]$/.test(isbn) &&
    isbn
      .split('')
      .reduce((sum, n, i) => sum + (n === 'X' ? 10 : Number(n)) * (10 - i), 0) %
      11 ===
      0
  )
    return 'search';
  return 'idle';
}
