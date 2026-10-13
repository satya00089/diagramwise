export type ReorderPosition = "before" | "after";

export type IdentifiedItem = {
  id: string;
};

/**
 * Move an item before or after another item without changing its identity.
 * Items in different groups cannot cross one another; this lets flattened
 * nested-field lists retain their parent-object structure.
 */
export const moveItemWithinGroup = <T extends IdentifiedItem, G>(
  items: T[],
  sourceId: string,
  targetId: string,
  position: ReorderPosition,
  getGroup: (item: T) => G,
): T[] => {
  if (sourceId === targetId) return items;

  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return items;

  const source = items[sourceIndex];
  const target = items[targetIndex];
  if (!source || !target || getGroup(source) !== getGroup(target)) return items;

  const groupIndexes = items.reduce<number[]>((indexes, item, index) => {
    if (getGroup(item) === getGroup(source)) indexes.push(index);
    return indexes;
  }, []);
  const groupItems = groupIndexes.map((index) => items[index]!);
  const sourceGroupIndex = groupItems.findIndex((item) => item.id === sourceId);
  const targetGroupIndex = groupItems.findIndex((item) => item.id === targetId);
  const [moved] = groupItems.splice(sourceGroupIndex, 1);
  if (!moved) return items;

  const adjustedTargetIndex = groupItems.findIndex(
    (item) => item.id === targetId,
  );
  const insertionIndex = adjustedTargetIndex + (position === "after" ? 1 : 0);
  groupItems.splice(insertionIndex, 0, moved);

  if (
    sourceGroupIndex === targetGroupIndex &&
    (position === "before"
      ? sourceGroupIndex === targetGroupIndex - 1
      : sourceGroupIndex === targetGroupIndex + 1)
  ) {
    return items;
  }

  const reordered = [...items];
  groupIndexes.forEach((index, groupIndex) => {
    reordered[index] = groupItems[groupIndex]!;
  });
  return reordered;
};
