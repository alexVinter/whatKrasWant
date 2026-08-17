// Small internal helper to build a stable latin slug from a (possibly Cyrillic)
// name. Slugs are an internal stable identifier and are never shown to users.

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterate(input: string): string {
  let out = '';
  for (const char of input.toLowerCase()) {
    out += Object.prototype.hasOwnProperty.call(CYRILLIC_MAP, char)
      ? CYRILLIC_MAP[char]
      : char;
  }
  return out;
}

export function slugify(name: string): string {
  const base = transliterate(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'item';
}
