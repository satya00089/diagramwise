export interface DiagramLoadAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

export type DiagramLoadMode = "private" | "public";

export function getDiagramLoadMode(
  auth: DiagramLoadAuthState,
): DiagramLoadMode | null {
  if (auth.isLoading) return null;
  return auth.isAuthenticated ? "private" : "public";
}
