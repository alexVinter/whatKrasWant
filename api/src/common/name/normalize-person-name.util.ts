const CYRILLIC_PATTERN = /[\u0400-\u04FF]/;

const LATIN_DIGRAPHS: ReadonlyArray<[string, string]> = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['ts', 'ц'],
  ['ey', 'ей'],
  ['ay', 'ай'],
  ['oy', 'ой'],
  ['iy', 'ий'],
  ['ya', 'я'],
  ['yu', 'ю'],
  ['yo', 'ё'],
  ['ye', 'е'],
];

const LATIN_SINGLES: Record<string, string> = {
  a: 'а',
  b: 'б',
  v: 'в',
  w: 'в',
  g: 'г',
  d: 'д',
  e: 'е',
  z: 'з',
  i: 'и',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  f: 'ф',
  h: 'х',
  c: 'к',
  q: 'к',
  x: 'кс',
  y: 'й',
};

function containsCyrillic(value: string): boolean {
  return CYRILLIC_PATTERN.test(value);
}

function transliterateLatinLower(input: string): string {
  let index = 0;
  let output = '';

  while (index < input.length) {
    const rest = input.slice(index);
    let matched = false;

    for (const [latin, cyrillic] of LATIN_DIGRAPHS) {
      if (rest.startsWith(latin)) {
        output += cyrillic;
        index += latin.length;
        matched = true;
        break;
      }
    }

    if (matched) {
      continue;
    }

    const char = input[index];
    output += LATIN_SINGLES[char] ?? char;
    index += 1;
  }

  return output;
}

function applyLatinTokenCase(source: string, transliterated: string): string {
  if (source === source.toUpperCase() && /[A-Za-z]/.test(source)) {
    return transliterated.toUpperCase();
  }

  if (/^[A-Z]/.test(source)) {
    return transliterated.charAt(0).toUpperCase() + transliterated.slice(1);
  }

  return transliterated;
}

function transliterateLatinToken(token: string): string {
  return applyLatinTokenCase(token, transliterateLatinLower(token.toLowerCase()));
}

export function normalizePersonName(value: string): string {
  if (!value || containsCyrillic(value)) {
    return value;
  }

  return value
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transliterateLatinToken(part)))
    .join('');
}
