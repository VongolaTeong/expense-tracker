/**
 * Stable per-category colors. Pure — no Expo imports.
 * Colors derive from a hash of the category id (not sort order), so they
 * survive sessions, reorders, and renames. Collisions are possible with many
 * categories and are acceptable.
 */

export const CATEGORY_PALETTE = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#9333ea', // purple
  '#ea580c', // orange
  '#0d9488', // teal
  '#b91c1c', // dark red
  '#4f46e5', // indigo
  '#ca8a04', // yellow
] as const;

export function categoryColor(categoryId: string): string {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i += 1) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}
