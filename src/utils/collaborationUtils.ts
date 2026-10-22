/**
 * Generate consistent colors for collaborators based on their user ID
 * Uses a hash function to ensure the same user always gets the same color
 */
export const getCollaboratorColor = (userId: string): string => {
  const colors = [
    "#10b981", // green
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#f59e0b", // amber
    "#ef4444", // red
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#6366f1", // indigo
  ];

  let hash = 0;
  for (const character of userId) {
    hash = (character.codePointAt(0) ?? 0) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};
