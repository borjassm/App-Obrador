/** Emoji mappings for products and families */

export const PRODUCT_EMOJI: Record<string, string> = {
  'Hogaza masa madre': '🍞',
  'Barra integral': '🥖',
  'Croissant mantequilla': '🥐',
  'Napolitana chocolate': '🍫',
  'Panettone': '🎄',
  'Roscón con nata': '🍩',
  'Roscón sin nata': '🍩',
  'Mini roscón': '🍩',
  'Pandoro': '🎄',
};

export const FAMILY_EMOJI: Record<string, string> = {
  panaderia: '🍞',
  laminado: '🥐',
  navidad: '🎄',
};

export function getProductEmoji(name: string): string {
  // Try exact match first
  if (PRODUCT_EMOJI[name]) return PRODUCT_EMOJI[name];

  // Try case-insensitive partial match
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(PRODUCT_EMOJI)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return emoji;
    }
  }

  return '🧁'; // Default bakery emoji
}

export function getFamilyEmoji(family: string): string {
  return FAMILY_EMOJI[family.toLowerCase()] ?? '🧁';
}
