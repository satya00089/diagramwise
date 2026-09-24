/**
 * Provider sprite sheets can introduce dark seams when transparent SVG artwork
 * is rasterized and clipped from a PNG sheet. Prefer the catalog's original
 * SVG for every supported provider; keep the sprite as a fallback when an
 * older or incomplete component record has no source URL.
 */
const SPRITE_PROVIDERS = new Set(["aws", "azure", "gcp", "kubernetes"]);

export function shouldUseDirectIcon(componentId?: string): boolean {
  if (!componentId) return false;
  const provider = componentId.split(/[-_.]/, 1)[0].toLowerCase();
  return SPRITE_PROVIDERS.has(provider);
}
