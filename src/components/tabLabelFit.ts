// px-3 on both sides + the 16px icon. Matches the tab button classes.
export const COLLAPSED_WIDTH = 40;
export const GAP = 8; // gap-2 between tabs
export const LABEL_GAP = 8; // pl-2 between icon and label

/**
 * Which tabs keep their label. Three states only: all labels when they fit,
 * else just the active tab's label if that fits, else none (icons only).
 * `labelWidths` is each label's width including its gap to the icon.
 */
export function tabsShowingLabel(
  ids: readonly string[],
  active: string,
  labelWidths: ReadonlyMap<string, number>,
  available: number,
): string[] {
  const iconsOnly = ids.length * COLLAPSED_WIDTH + (ids.length - 1) * GAP;
  const labelOf = (id: string) => labelWidths.get(id) ?? 0;
  const allLabels = ids.reduce((sum, id) => sum + labelOf(id), iconsOnly);
  if (allLabels <= available) return [...ids];
  if (iconsOnly + labelOf(active) <= available) return [active];
  return [];
}
