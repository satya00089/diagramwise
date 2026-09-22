export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string | null;
  createdAt?: string;
  preferences?: Record<string, unknown> | null;
  emailVerified?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name?: string;
  verificationReturnUrl?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupPendingResponse {
  message: string;
  email: string;
}

export interface DiagramOwner {
  id: string;
  name: string;
  email: string;
  pictureUrl?: string;
}

export interface SavedDiagram {
  id: string;
  userId: string;
  title: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  publishedAt?: string | null;
  viewCount?: number;
  recordType?: "canonical" | "public_snapshot" | "remix";
  familyId?: string | null;
  sourceDiagramId?: string | null;
  publicSnapshotId?: string | null;
  collaborators?: Collaborator[];
  // New fields from backend enhancement
  isOwner: boolean;
  permission: "owner" | "edit" | "read";
  owner: DiagramOwner;
  reasoningContext?: import("./systemDesign").DesignReasoningContext;
}

export interface SavedDiagramSummary {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  publishedAt?: string | null;
  viewCount?: number;
  recordType?: "canonical" | "public_snapshot" | "remix";
  familyId?: string | null;
  sourceDiagramId?: string | null;
  publicSnapshotId?: string | null;
  nodeCount: number;
  edgeCount: number;
  isOwner: boolean;
  permission: "owner" | "edit" | "read";
  owner: DiagramOwner;
}

export interface SavedDiagramPage {
  items: SavedDiagramSummary[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface Collaborator {
  id: string;
  email: string;
  permission: "read" | "edit";
  addedAt: string;
}

export interface SaveDiagramPayload {
  title: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
  reasoningContext?: import("./systemDesign").DesignReasoningContext;
  sourceDiagramId?: string;
  familyId?: string;
}
