import type {
  User,
  AuthResponse,
  SignupPendingResponse,
  LoginCredentials,
  SignupCredentials,
  SavedDiagram,
  SavedDiagramSummary,
  SavedDiagramPage,
  SaveDiagramPayload,
  Collaborator,
} from "../types/auth";
import type { CanvasContext, UserIntent } from "../types/chatBot";
import type {
  DesignReasoningContext,
  InterviewSession,
} from "../types/systemDesign";
import type {
  FeedbackResponse,
  FeedbackSubmission,
} from "../types/feedback";
import { getGoogleLoginStartUri } from "./googleAuth";

// VITE_API_URL is the application's documented API endpoint. Keep the older
// assessment-specific name as a fallback for existing deployments.
export const getApiBaseUrl = (apiUrl?: string, legacyApiUrl?: string): string =>
  apiUrl || legacyApiUrl || "";

export const getGoogleLoginRedirectUri = (apiBaseUrl: string): string =>
  `${apiBaseUrl.replace(/\/$/, "")}/api/v1/auth/google/redirect`;

const API_BASE_URL = getApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.VITE_ASSESSMENT_API_URL,
);

export const GOOGLE_LOGIN_REDIRECT_URI = getGoogleLoginRedirectUri(API_BASE_URL);
export const GOOGLE_LOGIN_START_URI = getGoogleLoginStartUri(API_BASE_URL);

class ApiService {
  private async createApiError(
    response: Response,
    fallback: string,
  ): Promise<Error & { status: number }> {
    const error = new Error(await this.getErrorMessage(response, fallback)) as Error & {
      status: number;
    };
    error.status = response.status;
    return error;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async getErrorMessage(
    response: Response,
    fallback: string,
  ): Promise<string> {
    const error = await response.json().catch(() => null);

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    if (error && typeof error === "object") {
      type DetailEntry = {
        msg?: unknown;
      };

      const message =
        "detail" in error && typeof error.detail === "string"
          ? error.detail
          : "detail" in error && Array.isArray(error.detail)
            ? error.detail
                .map((entry: unknown) =>
                  entry &&
                  typeof entry === "object" &&
                  typeof (entry as DetailEntry).msg === "string"
                    ? (entry as DetailEntry).msg
                    : null,
                )
                .filter((msg: string | null): msg is string => Boolean(msg))
                .join(", ")
            : "message" in error && typeof error.message === "string"
              ? error.message
              : null;

      if (message?.trim()) {
        return message;
      }
    }

    return fallback;
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, "Login failed"));
    }

    return response.json();
  }

  async signup(credentials: SignupCredentials): Promise<SignupPendingResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        name: credentials.name,
        verificationReturnUrl: credentials.verificationReturnUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, "Signup failed"));
    }

    return response.json();
  }

  async verifyEmail(
    userId: string,
    token: string,
  ): Promise<SignupPendingResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    });
    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Unable to activate your account"),
      );
    }
    return response.json();
  }

  async resendVerification(email: string): Promise<SignupPendingResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/auth/resend-verification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );
    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(
          response,
          "Unable to resend activation email",
        ),
      );
    }
    return response.json();
  }

  async googleLogin(credential: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Google login failed"),
      );
    }

    return response.json();
  }

  async exchangeGoogleLoginHandoff(code: string): Promise<AuthResponse> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/auth/google/redirect/exchange`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(
          response,
          "Google authentication link is invalid or expired",
        ),
      );
    }

    return response.json();
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    return response.json();
  }

  // User preferences endpoints
  async getPreferences(): Promise<Record<string, unknown> | null> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me/preferences`, {
      headers: this.getAuthHeaders(),
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to fetch preferences");

    return response.json();
  }

  async updatePreferences(
    preferences: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me/preferences`, {
      method: "PATCH",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(preferences),
    });

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Failed to update preferences"),
      );
    }

    return response.json();
  }

  // Diagram management endpoints
  async saveDiagram(payload: SaveDiagramPayload): Promise<SavedDiagram> {
    const response = await fetch(`${API_BASE_URL}/api/v1/diagrams`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Failed to Save Design"),
      );
    }

    return response.json();
  }

  async updateDiagram(
    id: string,
    payload: SaveDiagramPayload,
  ): Promise<SavedDiagram> {
    const response = await fetch(`${API_BASE_URL}/api/v1/diagrams/${id}`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Failed to update diagram"),
      );
    }

    return response.json();
  }

  async getUserDiagramPage(
    cursor?: string | null,
    limit = 24,
  ): Promise<SavedDiagramPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams?${params.toString()}`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch diagrams");
    }

    return response.json();
  }

  async getUserDiagrams(): Promise<SavedDiagramSummary[]> {
    const page = await this.getUserDiagramPage();
    return page.items;
  }

  async getDiagram(id: string): Promise<SavedDiagram> {
    const response = await fetch(`${API_BASE_URL}/api/v1/diagrams/${id}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw await this.createApiError(response, "Failed to fetch diagram");
    }

    return response.json();
  }

  async getPublicDiagram(id: string): Promise<SavedDiagram> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${id}/public`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw await this.createApiError(response, "Failed to fetch diagram");
    }

    return response.json();
  }

  async deleteDiagram(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/v1/diagrams/${id}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to delete diagram");
    }
  }

  // Collaborator management endpoints
  async addCollaborator(
    diagramId: string,
    email: string,
    permission: "read" | "edit",
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${diagramId}/share`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, permission }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Failed to add collaborator"),
      );
    }
  }

  async getCollaborators(diagramId: string): Promise<Collaborator[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${diagramId}/collaborators`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch collaborators");
    }

    return response.json();
  }

  async updateCollaborator(
    diagramId: string,
    collaboratorId: string,
    permission: "read" | "edit",
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${diagramId}/collaborators/${collaboratorId}`,
      {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ permission }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(response, "Failed to update collaborator"),
      );
    }
  }

  async removeCollaborator(
    diagramId: string,
    collaboratorId: string,
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${diagramId}/collaborators/${collaboratorId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to remove collaborator");
    }
  }

  // Problem attempts tracking
  async getAttemptedProblems(): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/problems/attempted`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      // Return empty array if endpoint fails (user not authenticated or endpoint not available)
      return [];
    }

    return response.json();
  }

  // Problem attempts management
  async saveAttempt(payload: {
    problemId: string;
    title: string;
    difficulty?: string;
    category?: string;
    nodes: unknown[];
    edges: unknown[];
    elapsedTime: number;
    lastAssessment?: unknown;
    reasoningContext?: DesignReasoningContext;
    interviewSession?: InterviewSession;
    addressedFindingIds?: string[];
  }): Promise<unknown> {
    const response = await fetch(`${API_BASE_URL}/api/v1/attempts`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Failed to save attempt" }));
      throw new Error(error.message || "Failed to save attempt");
    }

    return response.json();
  }

  async getUserAttempts(): Promise<unknown[]> {
    const response = await fetch(`${API_BASE_URL}/api/v1/attempts`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch attempts");
    }

    return response.json();
  }

  async getAttemptByProblem(problemId: string): Promise<unknown> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/attempts/problem/${problemId}`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch attempt");
    }

    return response.json();
  }

  async deleteAttempt(problemId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/attempts/problem/${problemId}`,
      {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete attempt");
    }
  }

  // Recommendations endpoint
  async getRecommendations(payload: {
    userIntent?: UserIntent | null;
    canvasContext: CanvasContext;
    components: Array<{
      id: string;
      type: string;
      label: string;
      hasDescription: boolean;
      properties?: Record<string, unknown>;
    }>;
    connections: Array<{
      source: string;
      target: string;
      type?: string;
      hasLabel: boolean;
    }>;
    maxSuggestions?: number;
  }): Promise<{
    recommendations: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      category:
        | "component"
        | "pattern"
        | "tip"
        | "best-practice"
        | "optimization";
      priority: number;
      confidence: number;
      actionType:
        | "add-component"
        | "add-pattern"
        | "info-only"
        | "connect"
        | "refactor";
      componentId?: string;
      componentIds?: string[];
      reasoning?: string;
    }>;
    totalCount: number;
    filteredCount: number;
    minConfidenceThreshold: number;
    contextSummary?: string;
    processingTimeMs?: number;
  }> {
    // Transform frontend types to backend format
    const requestPayload = {
      user_intent: payload.userIntent
        ? {
            title: payload.userIntent.title,
            description: payload.userIntent.description,
          }
        : null,
      canvas_context: {
        node_count: payload.canvasContext.nodeCount,
        edge_count: payload.canvasContext.edgeCount,
        component_types: payload.canvasContext.componentTypes,
        is_empty: payload.canvasContext.isEmpty,
      },
      components: payload.components.map((comp) => ({
        id: comp.id,
        type: comp.type,
        label: comp.label,
        has_description: comp.hasDescription,
        properties: comp.properties || {},
      })),
      connections: payload.connections.map((conn) => ({
        source: conn.source,
        target: conn.target,
        type: conn.type,
        has_label: conn.hasLabel,
      })),
      max_suggestions: payload.maxSuggestions || 5,
    };

    const response = await fetch(`${API_BASE_URL}/api/v1/recommendations`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      throw new Error("Failed to get recommendations");
    }

    const data = await response.json();

    // Transform backend response to frontend format
    return {
      recommendations: data.recommendations.map(
        (rec: {
          id: string;
          title: string;
          description: string;
          icon: string;
          category: string;
          priority: number;
          confidence: number;
          action_type: string;
          component_id?: string;
          component_ids?: string[];
          reasoning?: string;
        }) => ({
          id: rec.id,
          title: rec.title,
          description: rec.description,
          icon: rec.icon,
          category: rec.category,
          priority: rec.priority,
          confidence: rec.confidence,
          actionType: rec.action_type,
          componentId: rec.component_id,
          componentIds: rec.component_ids,
          reasoning: rec.reasoning,
        }),
      ),
      totalCount: data.total_count,
      filteredCount: data.filtered_count,
      minConfidenceThreshold: data.min_confidence_threshold,
      contextSummary: data.context_summary,
      processingTimeMs: data.processing_time_ms,
    };
  }

  // ---------------------------------------------------------------------------
  // Share to the World
  // ---------------------------------------------------------------------------

  async publishAttempt(
    attemptId: string,
  ): Promise<{ publicUrl: string; publishedAt: string; attemptId: string }> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/attempts/${encodeURIComponent(attemptId)}/publish`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, "Publish failed"));
    }
    return response.json();
  }

  async unpublishAttempt(attemptId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/attempts/${encodeURIComponent(attemptId)}/unpublish`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) throw new Error("Failed to unpublish solution");
  }

  async getPublicSolution(attemptId: string): Promise<{
    id: string;
    problemId: string;
    title: string;
    difficulty?: string;
    category?: string;
    nodes: unknown[];
    edges: unknown[];
    lastAssessment?: Record<string, unknown>;
    authorName?: string;
    authorPicture?: string;
    publishedAt?: string;
    viewCount: number;
    elapsedTime: number;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/solutions/${encodeURIComponent(attemptId)}`,
    );
    if (!response.ok)
      throw new Error("Solution not found or not publicly available");
    return response.json();
  }

  async getProblemLeaderboard(problemId: string): Promise<
    Array<{
      attemptId: string;
      authorName?: string;
      authorPicture?: string;
      score: number;
      publishedAt?: string;
      elapsedTime: number;
    }>
  > {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/problems/${encodeURIComponent(problemId)}/leaderboard`,
    );
    if (!response.ok) return [];
    return response.json();
  }

  async generateShareArticle(payload: {
    problemTitle: string;
    problemDescription?: string;
    score: number;
    strengths?: string[];
    improvements?: string[];
    nodeCount?: number;
    edgeCount?: number;
    scores?: Record<string, unknown>;
  }): Promise<{
    linkedinPost: string;
    twitterPost: string;
    mediumArticle: string;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/share/generate-article`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) throw new Error("Failed to generate article");
    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Free-design diagram public sharing
  // ---------------------------------------------------------------------------

  async publishDiagram(
    diagramId: string,
  ): Promise<{
    diagramId: string;
    publicUrl: string;
    publishedAt: string;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${encodeURIComponent(diagramId)}/publish`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) {
      throw new Error(await this.getErrorMessage(response, "Publish failed"));
    }
    return response.json();
  }

  async unpublishDiagram(diagramId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/diagrams/${encodeURIComponent(diagramId)}/unpublish`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
      },
    );
    if (!response.ok) throw new Error("Failed to unpublish diagram");
  }

  async getPublicDiagramData(diagramId: string): Promise<{
    id: string;
    title: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
    authorName?: string;
    authorPicture?: string;
    publishedAt?: string;
    viewCount: number;
    recordType?: "canonical" | "public_snapshot" | "remix";
    familyId?: string | null;
    sourceDiagramId?: string | null;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/public/diagrams/${encodeURIComponent(diagramId)}`,
    );
    if (!response.ok)
      throw new Error("Diagram not found or not publicly available");
    return response.json();
  }

  async getWalkthrough(
    problemId: string,
  ): Promise<import("../types/systemDesign").GuidedWalkthrough> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/problem/${encodeURIComponent(problemId)}/walkthrough`,
    );
    if (response.status === 404) {
      throw new Error("NOT_FOUND");
    }
    if (!response.ok) {
      throw new Error("Failed to fetch guided walkthrough");
    }
    return response.json();
  }

  // ---------------------------------------------------------------------------
  // ML training data — canvas event log ingestion
  // ---------------------------------------------------------------------------

  /**
   * Send a batch of canvas events to the backend for S3 storage.
   * Fire-and-forget: callers should not await this or handle errors.
   */
  async flushCanvasEvents(payload: {
    user_id: string;
    problem_id: string;
    session_id: string;
    events: Array<{
      ts: number;
      action: "add_node" | "delete_node" | "add_edge";
      type?: string;
      source_type?: string;
      target_type?: string;
      graph_node_count: number;
      graph_edge_count: number;
    }>;
  }): Promise<void> {
    await fetch(`${API_BASE_URL}/api/v1/events/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // ---------------------------------------------------------------------------
  // Product analytics ingestion
  // ---------------------------------------------------------------------------

  async sendAnalyticsEvent(payload: {
    user_id?: string;
    anon_id?: string;
    session_id: string;
    events: Array<{
      ts: number;
      event_name: string;
      page_url?: string;
      route?: string;
      page_title?: string;
      event_props?: Record<string, unknown>;
      time_on_page_ms?: number;
    }>;
  }): Promise<void> {
    await fetch(`${API_BASE_URL}/api/v1/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async flushAnalyticsEvents(payload: {
    user_id?: string;
    anon_id?: string;
    session_id: string;
    events: Array<{
      ts: number;
      event_name: string;
      page_url?: string;
      route?: string;
      page_title?: string;
      event_props?: Record<string, unknown>;
      time_on_page_ms?: number;
    }>;
  }): Promise<void> {
    await fetch(`${API_BASE_URL}/api/v1/analytics/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // Durable product feedback. Unlike analytics, written feedback is stored
  // as an individual item so it can be triaged and acted on later.
  async submitFeedback(
    payload: FeedbackSubmission,
  ): Promise<FeedbackResponse> {
    const response = await fetch(`${API_BASE_URL}/api/v1/feedback`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(
          response,
          "Feedback could not be sent. Please try again.",
        ),
      );
    }

    return response.json() as Promise<FeedbackResponse>;
  }

  // Retrieve learning progress for a path
  async getLearningProgress(pathId: string): Promise<string[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/learning-paths/${pathId}/progress`,
      {
        headers: this.getAuthHeaders(),
      },
    );

    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(
          response,
          "Failed to fetch learning progress",
        ),
      );
    }

    const data = await response.json();
    return Array.isArray(data?.completed) ? data.completed : [];
  }

  // Save learning progress for a path (frontend should call this when progress changes)
  async saveLearningProgress(
    pathId: string,
    completed: string[],
  ): Promise<Record<string, unknown>> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/learning-paths/${pathId}/progress`,
      {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ completed }),
      },
    );

    if (!response.ok) {
      throw new Error(
        await this.getErrorMessage(
          response,
          "Failed to save learning progress",
        ),
      );
    }

    return response.json() as Promise<Record<string, unknown>>;
  }
}

export const apiService = new ApiService();
