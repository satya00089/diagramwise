// React core
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

// State management
import { useSelector } from "react-redux";
import type { RootState } from "../store";

// External libraries - React Flow
import {
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  getNodesBounds,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";

// External libraries - Other
import { toPng, toJpeg, toSvg } from "html-to-image";
import dagre from "dagre";
import {
  MdAccessTime,
  MdUndo,
  MdRedo,
  MdClose,
  MdExpandMore,
  MdSave,
  MdHelpOutline,
  MdPublic,
  MdExtension,
} from "react-icons/md";
import { FcFlowChart } from "react-icons/fc";

// Routing
import { Link, useNavigate, useParams } from "react-router-dom";

// Type definitions
import type {
  SystemDesignProblem,
  SystemDesignSolution,
  ValidationResult,
  ComponentType,
  ConnectionType,
  GuidedStep,
  DesignReasoningContext,
  InterviewExchange,
  InterviewSession,
  AssessmentHistoryEntry,
} from "../types/systemDesign";
import type { SavedDiagram, Collaborator } from "../types/auth";
import type { ComponentProperty, CanvasComponent } from "../types/canvas";
import type { CanvasContext, UserIntent } from "../types/chatBot";

// Custom hooks
import { useTheme } from "../hooks/useTheme";
import { useUndoRedo } from "../hooks/useUndoRedo";
import { useAuth } from "../hooks/useAuth";
import { useCanvasEventLogger } from "../hooks/useCanvasEventLogger";
import { useToast } from "../hooks/useToast";
import { useChatBot } from "../hooks/useChatBot";
import { useUnifiedCollaboration } from "../hooks/useUnifiedCollaboration";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTour } from "../hooks/useTour";
import useAnalytics from "../hooks/useAnalytics";

// Redux store
import { useAppSelector, useAppDispatch } from "../store/hooks";
import {
  fetchFullComponent,
  type MinimalComponent,
} from "../store/slices/componentsSlice";

// Services and utilities
import { apiService } from "../services/api";
import assessSolution, { generateInterviewQuestions } from "../utils/assessor";
import { getCollaboratorColor } from "../utils/collaborationUtils";
import {
  exportAsJSON,
  exportAsXML,
  importFromJSON,
  importFromXML,
  downloadFile,
  readFileAsText,
} from "../utils/exportImport";

// Configuration
import { COMPONENTS } from "../config/components";
import {
  FLOW_PURPOSE_PLACEHOLDER,
  getPurposeValue,
  normalizeComponentProperties,
  normalizeEdgeDataPurpose,
  normalizeNodeDataPurpose,
  PURPOSE_PLACEHOLDER,
} from "../utils/purposeMigration";

// UI Components - Shared
import AnimatedCheckbox from "../components/shared/AnimatedCheckbox";
import {
  AnimatedNumberInput,
  AnimatedTextInput,
  AnimatedTextarea,
  AnimatedSelect,
} from "../components/shared/AnimatedInputFields";

// UI Components - Layout
import SEO from "../components/SEO";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { ToastContainer } from "../components/Toast";
import { AuthModal } from "../components/AuthModal";
import ShareToWorldModal from "../components/ShareToWorldModal";
import AssessmentInterviewDialog from "../components/AssessmentInterviewDialog";

// UI Components - Diagram
import DiagramCanvas from "../components/DiagramCanvas";
import ComponentPalette from "../components/ComponentPalette";
import InspectorPanel from "../components/InspectorPanel";

// UI Components - Nodes
import CustomNode from "../components/Node";
import type { NodeData } from "../components/Node";
import ERNode from "../components/ERNode";
import type { ERNodeData } from "../components/ERNode";
import TableNode from "../components/TableNode";
import type { TableNodeData, TableAttribute } from "../components/TableNode";
import {
  isContentSizedTableNode,
  isFieldAddressableERTable,
} from "../utils/erdNode";
import GroupNode from "../components/GroupNode";
import FreeformNode from "../components/FreeformNode";
import type { FreeformNodeData } from "../components/FreeformNode";

// UI Components - Edges
import CustomEdge from "../components/CustomEdge";
import ERRelationshipEdge from "../components/ERRelationshipEdge";

// UI Components - Collaboration
import { CollaborationStatus } from "../components/CollaborationStatus";
import { CollaboratorCursor } from "../components/CollaboratorCursor";
import CollaboratorsList from "../components/CollaboratorsList";

// UI Components - Features
import { ChatBot } from "../components/ChatBot";
import { ProjectIntentDialog } from "../components/ProjectIntentDialog";
import CustomPropertyInput, {
  type CustomProperty,
} from "../components/CustomPropertyInput";
import ExtensionHub from "../components/ExtensionHub";
import type { ExtensionImportResult } from "../types/extensions";
import { getAdaptiveFitViewOptions } from "../utils/adaptiveFitView";
import {
  canUseERDLayout,
  getERDLayoutedNodes,
  getLayoutDirectionForMenu,
} from "../utils/erdLayout";

// Type alias for all node data types
type AnyNodeData = NodeData | ERNodeData | TableNodeData | FreeformNodeData;

type DiagramAccessState =
  | "loading"
  | "requires-auth"
  | "forbidden"
  | "not-found"
  | "error"
  | null;

// These IDs are the stable internal IDs of provider-neutral catalog entries.
// They must never be sent to the provider-backed component endpoint, which
// only knows provider-specific records.
const GENERIC_COMPONENT_IDS = new Set([
  "application-server",
  "cache",
  "custom-component",
  "database",
  "load-balancer",
  "queue",
]);

const isGenericComponentReference = (
  componentId: string | null | undefined,
  provider?: unknown,
  catalogRef?: unknown,
): boolean =>
  provider === "generic" ||
  (typeof catalogRef === "string" && catalogRef.startsWith("generic.")) ||
  (typeof componentId === "string" && GENERIC_COMPONENT_IDS.has(componentId));

const getApiErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
};

// Persists the user's "Skip for now" / submit choice on the project intent
// dialog so it doesn't reappear after a remount or after the canvas briefly
// goes non-blank and back (e.g. add then delete a node).
const PROJECT_INTENT_DISMISSED_KEY = "diagrammatic:projectIntentDismissed";

// Persists that the user dismissed the "Save Your Design" prompt for the
// current unsaved diagram, so navigating away and back (which remounts this
// component and resets the in-memory ref) doesn't re-prompt on every change.
const SAVE_DIALOG_DISMISSED_KEY = "diagrammatic:saveDialogDismissed";

interface SystemDesignPlaygroundProps {
  problem?: SystemDesignProblem | null;
  onBack?: () => void;
}

// Define edgeTypes outside component to prevent re-creation on every render
const edgeTypes = {
  customEdge: CustomEdge,
  erRelationship: ERRelationshipEdge,
};

type AttemptContentSnapshotInput = {
  problemId: string;
  title: string;
  difficulty?: string;
  category?: string;
  nodes: Node[];
  edges: Edge[];
  reasoningContext: DesignReasoningContext;
  interviewSession: InterviewSession;
  addressedFindingIds?: string[];
};

// elapsedTime is intentionally excluded so timer ticks can trigger the
// auto-save check without making an unchanged canvas dirty.
const getAttemptContentSnapshot = ({
  problemId,
  title,
  difficulty,
  category,
  nodes,
  edges,
  reasoningContext,
  interviewSession,
  addressedFindingIds,
}: AttemptContentSnapshotInput): string =>
  JSON.stringify({
    problemId,
    title,
    difficulty,
    category,
    nodes,
    edges,
    reasoningContext,
    interviewSession,
    addressedFindingIds,
  });

const getCanvasNodeType = (node: Node): string => {
  const data = (node.data ?? {}) as { type?: unknown };
  return typeof data.type === "string" && data.type.trim()
    ? data.type
    : node.type || "component";
};

const buildProvidedReasoningContext = (
  problem: SystemDesignProblem | null,
  nodes: Node[],
  edges: Edge[],
): DesignReasoningContext => {
  const problemRequirements = problem
    ? [
        problem.description,
        ...problem.requirements.map((requirement) => `- ${requirement}`),
        ...problem.constraints.map((constraint) => `Constraint: ${constraint}`),
      ]
        .filter(Boolean)
        .join("\n")
    : "No problem brief is attached. Use the design title and canvas as the starting context.";

  const typeCounts = new Map<string, number>();
  nodes.forEach((node) => {
    const type = getCanvasNodeType(node);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  });
  const componentSummary = Array.from(typeCounts.entries())
    .map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`)
    .join(", ");

  const connectedNodeIds = new Set(
    edges.flatMap((edge) => [edge.source, edge.target]),
  );
  const disconnectedCount = nodes.filter(
    (node) => !connectedNodeIds.has(node.id),
  ).length;

  const unstatedTarget = (target: string) =>
    `No explicit ${target} target is specified in the brief. State an assumption when asked during the interview.`;

  const canvasDescription = componentSummary || `${nodes.length} components`;
  const disconnectedLabel =
    disconnectedCount === 1 ? "component is" : "components are";
  return {
    requirements: problemRequirements,
    scaleAssumptions: unstatedTarget("scale"),
    expectedTraffic: unstatedTarget("traffic profile"),
    readWriteRatio: unstatedTarget("read/write ratio"),
    latencyGoals: unstatedTarget("latency"),
    availabilityTarget: unstatedTarget("availability"),
    consistencyRequirements: unstatedTarget("consistency"),
    technologyChoices: nodes.length
      ? `The current canvas contains ${canvasDescription}. Explain why these choices fit the problem.`
      : "No components are on the canvas yet.",
    tradeoffs:
      "Trade-offs are not pre-filled. Explain them during the interview.",
    unresolvedRisks:
      disconnectedCount > 0
        ? `${disconnectedCount} ${disconnectedLabel} currently disconnected. Review its role and failure paths.`
        : "Review failure paths, security, and operational risks during the interview.",
  };
};

function getAssessmentScoreBand(score: number) {
  if (score >= 80) return "strong";
  return score >= 50 ? "needs_work" : "weak";
}

function getAssessmentActionLabel(
  isAssessing: boolean,
  isPreparingInterview: boolean,
) {
  if (isAssessing) return "Assessing...";
  return isPreparingInterview ? "Preparing..." : "Run Assessment";
}

function getAssessmentTooltip(
  isAuthenticated: boolean,
  isAssessing: boolean,
  isPreparingInterview: boolean,
) {
  if (!isAuthenticated) return "Please sign in to run assessment";
  if (isAssessing) return "Assessment in progress...";
  return isPreparingInterview
    ? "Preparing interview questions..."
    : "Run assessment on current design";
}

type ProvidedCanvasStats = {
  componentCount: number;
  connectionCount: number;
  componentTypes: string[];
  disconnectedCount: number;
};

const DEFAULT_PRE_ASSESSMENT_QUESTIONS = [
  "What scale and traffic pattern are you designing for, and which part of the architecture becomes the bottleneck first?",
  "What happens when one critical dependency fails, and how does the system recover without losing important data?",
  "Which consistency and storage trade-off did you make, and why is it appropriate for this problem?",
];

const getProvidedCanvasStats = (
  nodes: Node[],
  edges: Edge[],
): ProvidedCanvasStats => {
  const connectedNodeIds = new Set(
    edges.flatMap((edge) => [edge.source, edge.target]),
  );

  return {
    componentCount: nodes.length,
    connectionCount: edges.length,
    componentTypes: Array.from(
      new Set(nodes.map((node) => getCanvasNodeType(node))),
    ),
    disconnectedCount: nodes.filter((node) => !connectedNodeIds.has(node.id))
      .length,
  };
};

const buildSystemDesignSolution = (
  nodes: Node[],
  edges: Edge[],
  reasoningContext: DesignReasoningContext,
): SystemDesignSolution => ({
  components: nodes.map((n) => {
    const dataObj = (n.data ?? {}) as unknown;
    const maybeType = (dataObj as { type?: unknown }).type;
    let inferredType: ComponentType;
    if (typeof maybeType === "string")
      inferredType = maybeType as ComponentType;
    else if (typeof n.type === "string") inferredType = n.type as ComponentType;
    else inferredType = "microservice";

    const maybeLabel = (dataObj as { label?: unknown }).label;
    const label = typeof maybeLabel === "string" ? maybeLabel : String(n.id);
    const allProperties =
      dataObj && typeof dataObj === "object"
        ? ({ ...dataObj } as Record<string, unknown>)
        : {};
    // Icons and subtitles are presentation details; the remaining node data
    // is useful architectural context for the reviewer.
    const customProperties = { ...allProperties };
    delete customProperties.icon;
    delete customProperties.subtitle;

    return {
      id: n.id,
      type: inferredType,
      label,
      position: { x: n.position?.x ?? 0, y: n.position?.y ?? 0 },
      properties: {
        ...customProperties,
        nodeData: {
          label,
          icon: (dataObj as { icon?: unknown }).icon,
          subtitle: (dataObj as { subtitle?: unknown }).subtitle,
        },
      },
    };
  }),
  connections: edges.map((e) => {
    const dataObj = (e.data ?? {}) as unknown;
    const maybeType = (dataObj as { type?: unknown }).type;
    const inferredType: ConnectionType =
      typeof maybeType === "string"
        ? (maybeType as ConnectionType)
        : "api-call";
    const maybeLabel = (dataObj as { label?: unknown }).label;
    const maybePurpose = getPurposeValue(dataObj as Record<string, unknown>);

    return {
      id: e.id ?? `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: inferredType,
      label: typeof maybeLabel === "string" ? maybeLabel : undefined,
      description:
        typeof maybePurpose === "string" && maybePurpose.trim()
          ? maybePurpose
          : undefined,
      properties: dataObj as Record<string, unknown>,
    };
  }),
  // Generated context is sent separately so the assessor can distinguish
  // product facts from a candidate's explanation.
  explanation: "",
  keyPoints: [],
  reasoningContext,
});

// Create a wrapper component for CustomNode with onCopy prop
const NodeWithCopy = React.memo(
  (props: {
    id: string;
    data: unknown;
    onCopy: (id: string, data: AnyNodeData) => void;
    isInGroup?: boolean;
  }) => {
    const nodeData = props.data as NodeData;
    return (
      <CustomNode
        id={props.id}
        data={nodeData}
        onCopy={(id, data) => props.onCopy(id, data)}
        isInGroup={props.isInGroup}
      />
    );
  },
);

// Create a wrapper component for ERNode with onCopy prop
const ERNodeWithCopy = React.memo(
  (props: {
    id: string;
    data: unknown;
    onCopy: (id: string, data: AnyNodeData) => void;
    isInGroup?: boolean;
  }) => {
    const nodeData = props.data as ERNodeData;
    return (
      <ERNode
        id={props.id}
        data={nodeData}
        onCopy={(id, data) => props.onCopy(id, data)}
        isInGroup={props.isInGroup}
      />
    );
  },
);

// Create a wrapper component for TableNode with onCopy prop
const TableNodeWithCopy = React.memo(
  (props: {
    id: string;
    data: unknown;
    onCopy: (id: string, data: AnyNodeData) => void;
    isInGroup?: boolean;
  }) => {
    const nodeData = props.data as TableNodeData;
    return (
      <TableNode
        id={props.id}
        data={nodeData}
        onCopy={(id, data) => props.onCopy(id, data)}
        isInGroup={props.isInGroup}
      />
    );
  },
);

// Factory function to create node component with copy handler and group detection
const createNodeWithCopyHandler = (
  onCopy: (id: string, data: AnyNodeData) => void,
  nodesRef: React.RefObject<Node[]>,
) => {
  return (props: { id: string; data: unknown }) => {
    const isInGroup =
      nodesRef.current?.find((n) => n.id === props.id)?.parentId !== undefined;
    return <NodeWithCopy {...props} onCopy={onCopy} isInGroup={isInGroup} />;
  };
};

// Factory function to create ER node component with copy handler and group detection
const createERNodeWithCopyHandler = (
  onCopy: (id: string, data: AnyNodeData) => void,
  nodesRef: React.RefObject<Node[]>,
) => {
  return (props: { id: string; data: unknown }) => {
    const isInGroup =
      nodesRef.current?.find((n) => n.id === props.id)?.parentId !== undefined;
    return <ERNodeWithCopy {...props} onCopy={onCopy} isInGroup={isInGroup} />;
  };
};

// Factory function to create table node component with copy handler and group detection
const createTableNodeWithCopyHandler = (
  onCopy: (id: string, data: AnyNodeData) => void,
  nodesRef: React.RefObject<Node[]>,
) => {
  return (props: { id: string; data: unknown }) => {
    const isInGroup =
      nodesRef.current.find((n) => n.id === props.id)?.parentId !== undefined;
    return (
      <TableNodeWithCopy {...props} onCopy={onCopy} isInGroup={isInGroup} />
    );
  };
};

// Create a wrapper component for FreeformNode with onCopy prop
const FreeformNodeWithCopy = React.memo(
  (props: {
    id: string;
    data: unknown;
    selected?: boolean;
    onCopy: (id: string, data: AnyNodeData) => void;
    isInGroup?: boolean;
  }) => {
    const nodeData = props.data as FreeformNodeData;
    return (
      <FreeformNode
        id={props.id}
        data={nodeData}
        selected={props.selected}
        onCopy={(id, data) => props.onCopy(id, data)}
        isInGroup={props.isInGroup}
      />
    );
  },
);

// Factory function to create freeform node component with copy handler and group detection
const createFreeformNodeWithCopyHandler = (
  onCopy: (id: string, data: AnyNodeData) => void,
  nodesRef: React.RefObject<Node[]>,
) => {
  return (props: { id: string; data: unknown; selected?: boolean }) => {
    const isInGroup =
      nodesRef.current?.find((n) => n.id === props.id)?.parentId !== undefined;
    return (
      <FreeformNodeWithCopy {...props} onCopy={onCopy} isInGroup={isInGroup} />
    );
  };
};

const SystemDesignPlayground: React.FC<SystemDesignPlaygroundProps> = () => {
  useTheme();
  const navigate = useNavigate();
  const params = useParams();
  const idFromUrl = params?.id;
  const publicId = params?.publicId; // populated when routed via /public/:publicId
  const isSharedView = !!publicId;
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();
  const { user, isAuthenticated, login, signup, googleLogin, logout } =
    useAuth();
  const { trackEvent } = useAnalytics({ isEnabled: true });

  // Get full components cache for iconUrl support
  const dispatch = useAppDispatch();
  const {
    fullComponentsCache,
    minimalComponents,
    minimalComponentsByProvider,
  } = useAppSelector((state) => state.components);

  // Utility function to restore React icon components for nodes loaded from storage/Yjs
  const restoreNodeIcons = useCallback(
    (nodesToRestore: Node[]): Node[] => {
      return nodesToRestore.map((node) => {
        const componentId =
          typeof node.data?.componentId === "string"
            ? node.data.componentId
            : null;

        // Find matching component from local config
        const localComp = componentId
          ? COMPONENTS.find((c) => c.id === componentId)
          : null;
        const catalogRef =
          typeof node.data?.catalogRef === "string"
            ? node.data.catalogRef
            : "";
        const isGenericCatalogComponent = isGenericComponentReference(
          componentId,
          node.data?.provider,
          catalogRef,
        );

        // Restore icon from local component if available
        const restoredIcon = localComp?.icon || node.data?.icon;
        const componentProperties = normalizeComponentProperties(
          localComp?.properties || fullComponentsCache[componentId || ""]?.properties || [],
        );

        // Fetch full component data if it's a provider component (AWS, Azure, etc.)
        // Imported extension nodes intentionally use a generic architectureType
        // instead of a provider-qualified component ID, so they must never
        // trigger a provider lookup.
        if (
          componentId &&
          !localComp &&
          !fullComponentsCache[componentId] &&
          !node.data?.extensionSource &&
          !isGenericCatalogComponent
        ) {
          dispatch(fetchFullComponent(componentId));
        }

        return {
          ...node,
          data: {
            ...normalizeNodeDataPurpose(
              (node.data || {}) as Record<string, unknown>,
              componentProperties,
            ),
            icon: restoredIcon, // Restore React icon component
            iconUrl: node.data?.iconUrl, // Keep iconUrl if it exists
          },
        } as Node;
      });
    },
    [fullComponentsCache, dispatch],
  );

  const restoreEdgePurposes = useCallback(
    (edgesToRestore: Edge[]): Edge[] =>
      edgesToRestore.map((edge) => ({
        ...edge,
        data: normalizeEdgeDataPurpose(
          (edge.data || {}) as Record<string, unknown>,
        ),
      })),
    [],
  );

  // Chat bot context for getting user intent
  const { userIntent, setUserIntent, resetChatBot } = useChatBot();

  // Onboarding — tour management
  const { isNewToPage, markPageVisited } = useOnboarding();
  const tourPageId =
    idFromUrl === "free" ? "design_studio" : "problem_playground";
  const { startTour } = useTour(tourPageId);

  // Toast notifications
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Store current nodes in ref to avoid dependency issues
  const nodesRef = useRef<Node[]>([]);
  // Store current edges in ref (used by event logger for edge count)
  const edgesRef = useRef<Edge[]>([]);

  // Track if we've shown the project intent dialog for this session
  const hasShownProjectIntentRef = useRef(false);

  // Track if user dismissed the save dialog — don't auto-prompt again until they click Save
  const userDeclinedSaveRef = useRef(false);

  // Track the last successfully persisted problem attempt content so timer
  // updates can skip redundant requests.
  const lastSavedAttemptContentRef = useRef<string | null>(null);
  const attemptSaveInFlightRef = useRef(false);
  const firstComponentTrackedRef = useRef(false);
  const firstConnectionTrackedRef = useRef(false);
  const challengeStartedTrackedRef = useRef(false);
  const persistedAssessmentCountRef = useRef(0);

  // Get diagramId from query parameters
  const searchParams = new URLSearchParams(globalThis.location.search);
  const diagramIdFromUrl = searchParams.get("diagramId");
  const remixIdFromUrl = searchParams.get("remix");

  // State for problem data
  const [problem, setProblem] = useState<SystemDesignProblem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Auth and diagram management state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [diagramAccessState, setDiagramAccessState] =
    useState<DiagramAccessState>(null);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(
    null,
  );
  const [remixOrigin, setRemixOrigin] = useState<{
    sourceDiagramId: string;
    familyId?: string | null;
  } | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Persist the pre-assessment interview transcript with the current attempt.
  const [interviewSession, setInterviewSession] = useState<InterviewSession>({
    exchanges: [],
    currentQuestionIndex: 0,
  });
  const [assessmentHistory, setAssessmentHistory] = useState<
    AssessmentHistoryEntry[]
  >([]);
  const [addressedFindingIds, setAddressedFindingIds] = useState<string[]>([]);

  // Project Intent dialog state (shown when entering Design Studio)
  const [showProjectIntentDialog, setShowProjectIntentDialog] = useState(false);

  // Title/Description dialog state for first save
  const [showTitleDialog, setShowTitleDialog] = useState(false);

  // Sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "edit">(
    "read",
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);

  // Share to the World state
  const [showShareToWorldModal, setShowShareToWorldModal] = useState(false);
  const [savedAttemptId, setSavedAttemptId] = useState<string | null>(null);
  const [isAttemptPublic, setIsAttemptPublic] = useState(false);
  // Read-only shared view CTA
  const [sharedCta, setSharedCta] = useState<{
    to: string;
    label: string;
  } | null>(null);

  // Collaboration is always enabled for saved diagrams (Figma-style)
  // No manual toggle needed - automatically connects when diagram is loaded

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);

  // Timer state - always running for problems
  const [elapsedTime, setElapsedTime] = useState<number>(0); // in seconds
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch problem from API or localStorage
  useEffect(() => {
    if (!idFromUrl) {
      if (!isSharedView) {
        setLoading(false);
        setError("No problem ID provided");
      }
      return;
    }

    // Handle "free" mode - no problem, just canvas
    if (idFromUrl === "free") {
      setProblem({
        id: "free",
        title: "Design Studio",
        description: "Create your own system design from scratch",
        difficulty: "Medium",
        category: "Custom",
        domain: "application",
        estimated_time: "Unlimited",
        requirements: [],
        constraints: [],
        hints: [],
        tags: ["custom", "free-design"],
      });
      setLoading(false);
      return;
    }

    // Check if it's a custom problem from localStorage
    if (idFromUrl.startsWith("custom-")) {
      const customProblemData = localStorage.getItem(
        `custom-problem-${idFromUrl}`,
      );
      if (customProblemData) {
        setProblem(JSON.parse(customProblemData));
        setLoading(false);
        return;
      }
    }

    const fetchProblem = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiUrl =
          import.meta.env.VITE_ASSESSMENT_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/v1/problem/${idFromUrl}`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch problem: ${response.status} ${response.statusText}`,
          );
        }

        const data = await response.json();
        setProblem(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching the problem",
        );
        console.error("Error fetching problem:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [idFromUrl, isSharedView]);

  useEffect(() => {
    if (
      challengeStartedTrackedRef.current ||
      !idFromUrl ||
      idFromUrl === "free" ||
      isSharedView ||
      loading ||
      !problem
    ) {
      return;
    }

    challengeStartedTrackedRef.current = true;
    trackEvent("challenge_started", {
      problem_id: problem.id || idFromUrl,
      problem_slug: problem.slug,
      difficulty: problem.difficulty,
      domain: problem.domain,
      auth_state: isAuthenticated ? "authenticated" : "anonymous",
      attempt_kind: isAuthenticated ? "resume_or_new" : "anonymous",
    });
  }, [idFromUrl, isAuthenticated, isSharedView, loading, problem, trackEvent]);

  const onBack = () => navigate("/");

  // Mark page visited + auto-start onboarding tour for new users (skip shared views)
  useEffect(() => {
    if (isSharedView || !idFromUrl) return;
    const isNew = isNewToPage(tourPageId);
    markPageVisited(tourPageId);
    if (isNew) {
      // Wait for canvas/UI to render before driving the tour
      const t = setTimeout(() => startTour(), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl]);

  // Load shared (read-only) data when routed via /public/:publicId
  useEffect(() => {
    // Reconstruct an effective id that handles two hosting cases:
    // 1) publicId param contains an encoded '%23' (normal)
    // 2) some hosts/browsers decode '%23' into '#' so the second part becomes a fragment
    let effectiveId: string | null = null;

    if (publicId) {
      // common case: param present (may be percent-encoded)
      try {
        effectiveId = decodeURIComponent(publicId);
      } catch {
        effectiveId = publicId;
      }
    } else {
      // Fallback: read the pathname directly (handles hosts that strip params)
      const m = /\/public\/(.+)$/.exec(globalThis.location.pathname);
      if (m) {
        try {
          effectiveId = decodeURIComponent(m[1]);
        } catch {
          effectiveId = m[1];
        }
      }
    }

    // If there's a fragment (decoded '#' that split the path), append it
    const frag = globalThis.location.hash.replace(/^#/, "");
    if (frag && effectiveId && !effectiveId.includes("#")) {
      effectiveId = `${effectiveId}#${frag}`;
    }

    if (!effectiveId) return;

    setLoading(true);
    setError(null);

    const isAttempt = effectiveId.includes("#");
    const loader = isAttempt
      ? apiService.getPublicSolution(effectiveId).then((res) => ({
          title: res.title,
          difficulty: res.difficulty as
            | SystemDesignProblem["difficulty"]
            | undefined,
          category: res.category,
          nodes: res.nodes as Node[],
          edges: res.edges as Edge[],
          assessment: (res.lastAssessment ??
            null) as unknown as ValidationResult | null,
          problemId: res.problemId as string | undefined,
        }))
      : apiService.getPublicDiagramData(effectiveId).then((res) => ({
          title: res.title,
          difficulty: undefined,
          category: undefined,
          nodes: res.nodes as Node[],
          edges: res.edges as Edge[],
          assessment: null as ValidationResult | null,
          problemId: undefined as string | undefined,
        }));

    loader
      .then((d) => {
        setProblem({
          id: effectiveId,
          title: d.title,
          description: "",
          difficulty: d.difficulty ?? "Medium",
          category: d.category ?? "Custom",
          domain: "application",
          estimated_time: "",
          requirements: [],
          constraints: [],
          hints: [],
          tags: [],
        });
        setNodes(restoreNodeIcons(d.nodes));
        setEdges(restoreEdgePurposes(d.edges));
        if (d.assessment)
          setAssessment(d.assessment as unknown as ValidationResult);
        setActiveRightTab("assessment");
        setSharedCta(
          isAttempt && d.problemId
            ? {
                to: `/playground/${d.problemId}`,
                label: "Try this problem \u2192",
              }
            : { to: "/playground/free", label: "Try by yourself \u2192" },
        );
      })
      .catch(() =>
        setError("This design is not available or has been unpublished."),
      )
      .finally(() => setLoading(false));
  }, [publicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Undo/Redo state management
  interface CanvasState {
    nodes: Node[];
    edges: Edge[];
  }

  const {
    state: canvasState,
    setState: setCanvasState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useUndoRedo<CanvasState>({
    nodes: [],
    edges: [],
  });

  // Use React Flow's state hooks but sync with undo/redo
  const [nodes, setNodes, onNodesChange] = useNodesState(canvasState.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(canvasState.edges);
  const { getNodes, fitView } = useReactFlow();

  // Review context is supplied by the problem brief and the current canvas.
  // There is deliberately no editable form for these values.
  const reasoningContext = useMemo(
    () => buildProvidedReasoningContext(problem, nodes, edges),
    [problem, nodes, edges],
  );
  const providedCanvasStats = useMemo(
    () => getProvidedCanvasStats(nodes, edges),
    [nodes, edges],
  );

  // Track if we're currently applying undo/redo to prevent circular updates
  const isApplyingUndoRedo = useRef(false);

  // Update nodes/edges refs whenever state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Canvas event logger — buffers structural events and flushes to S3 every 15 s
  // Only enabled for authenticated users solving a named problem (not free canvas)
  const { logNodeAdded, logNodeDeleted, logEdgeAdded } = useCanvasEventLogger({
    userId: user?.id,
    problemId: idFromUrl,
    isEnabled:
      isAuthenticated && !isSharedView && !!idFromUrl && idFromUrl !== "free",
  });

  // Wrapped change handlers — intercept add/remove events for training data before
  // forwarding to React Flow's built-in state updaters
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      for (const change of changes) {
        if (change.type === "add") {
          logNodeAdded(nodesRef, edgesRef, change.item);
        } else if (change.type === "remove") {
          const removed = nodesRef.current.find((n) => n.id === change.id);
          if (removed) logNodeDeleted(nodesRef, edgesRef, removed);
        }
      }
      onNodesChange(changes);
    },
    [onNodesChange, logNodeAdded, logNodeDeleted],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      for (const change of changes) {
        if (change.type === "add") {
          logEdgeAdded(
            nodesRef,
            edgesRef,
            change.item.source,
            change.item.target,
          );
        }
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, logEdgeAdded],
  );

  // Show project intent dialog when entering Design Studio with blank canvas
  useEffect(() => {
    if (idFromUrl === "free" && !loading) {
      // Check if this is a blank canvas (no diagram loaded, no nodes)
      const isBlankCanvas =
        !currentDiagramId &&
        !diagramIdFromUrl &&
        !remixIdFromUrl &&
        nodes.length === 0;

      const alreadyDismissed =
        localStorage.getItem(PROJECT_INTENT_DISMISSED_KEY) === "true";

      if (
        isBlankCanvas &&
        !hasShownProjectIntentRef.current &&
        !alreadyDismissed
      ) {
        // Reset chat bot for fresh start on blank canvas
        resetChatBot();

        // Show dialog after a brief delay for better UX
        const timer = setTimeout(() => {
          setShowProjectIntentDialog(true);
          hasShownProjectIntentRef.current = true;
        }, 500);
        return () => clearTimeout(timer);
      } else if (!isBlankCanvas) {
        // Reset the flag when a diagram is loaded
        hasShownProjectIntentRef.current = false;
      }
    }
  }, [
    idFromUrl,
    loading,
    currentDiagramId,
    diagramIdFromUrl,
    remixIdFromUrl,
    nodes.length,
    resetChatBot,
  ]);

  // State for layout menu
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [showExtensionHub, setShowExtensionHub] = useState(false);
  const [extensionImportStatus, setExtensionImportStatus] = useState<
    string | null
  >(null);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load diagram from URL parameter if diagramId is present, or load saved progress for problems
  useEffect(() => {
    lastSavedAttemptContentRef.current = null;
    if (!diagramIdFromUrl) {
      setDiagramAccessState(null);
    }

    if (idFromUrl === "free" && remixIdFromUrl) {
      const loadRemix = async () => {
        try {
          const publicDiagram =
            await apiService.getPublicDiagramData(remixIdFromUrl);
          const restoredNodes = restoreNodeIcons(publicDiagram.nodes as Node[]);
          const restoredEdges = restoreEdgePurposes(publicDiagram.edges as Edge[]);
          const baseTitle = publicDiagram.title.trim() || "Shared design";

          setNodes(restoredNodes);
          setEdges(restoreEdgePurposes(restoredEdges));
          setCurrentDiagramId(null);
          setCurrentDiagram(null);
          setRemixOrigin({
            sourceDiagramId: remixIdFromUrl,
            familyId: publicDiagram.familyId,
          });
          setUserIntent({
            title: `${baseTitle.slice(0, 188)} — Remix`,
            description:
              publicDiagram.description?.slice(0, 1000) ||
              "Editable remix of a public Diagramwise design.",
            timestamp: new Date(),
          });
          setCanvasState({ nodes: restoredNodes, edges: restoredEdges });
          window.setTimeout(
            () =>
              fitView({
                ...getAdaptiveFitViewOptions(restoredNodes, restoredEdges),
                duration: 400,
              }),
            100,
          );
          toast.success(
            isAuthenticated
              ? "Remix created. Your copy will save automatically."
              : "Remix created. Sign in when you are ready to save it.",
          );
        } catch (err) {
          console.error("Failed to load public design for remix:", err);
          toast.error(
            "This design could not be remixed. It may no longer be public.",
          );
        }
      };

      void loadRemix();
    } else if (diagramIdFromUrl) {
      // A diagram URL can point to either a private editor record or a public
      // snapshot. Try the account-scoped record first for signed-in users,
      // while preserving the public-link experience for everyone else.
      let cancelled = false;
      const loadDiagramFromUrl = async () => {
        if (cancelled) return;
        setDiagramAccessState("loading");
        setNodes([]);
        setEdges([]);
        setCurrentDiagramId(null);
        setCurrentDiagram(null);

        const applyDiagram = (diagram: SavedDiagram) => {
          if (cancelled) return;
          const loadedNodes = diagram.nodes as Node[];
          const loadedEdges = restoreEdgePurposes(diagram.edges as Edge[]);

          // Restore icon components and ensure we have full component data
          const restoredNodes = restoreNodeIcons(loadedNodes);

          setNodes(restoredNodes);
          setEdges(restoreEdgePurposes(loadedEdges));
          setCurrentDiagramId(diagram.id);
          setCurrentDiagram(diagram);
          setRemixOrigin(null);

          // Immediately update canvas state to prevent undo/redo from
          // clearing the loaded data while the rest of the page mounts.
          setCanvasState({ nodes: restoredNodes, edges: loadedEdges });
          setDiagramAccessState(null);
        };

        try {
          if (!isAuthenticated) {
            applyDiagram(await apiService.getPublicDiagram(diagramIdFromUrl));
            return;
          }

          try {
            applyDiagram(await apiService.getDiagram(diagramIdFromUrl));
          } catch (privateError) {
            if (cancelled) return;
            // A signed-in user may still be opening a public editor-shaped
            // link. Keep that compatible by falling back to the public copy.
            try {
              applyDiagram(
                await apiService.getPublicDiagram(diagramIdFromUrl),
              );
            } catch (publicError) {
              if (cancelled) return;
              const privateStatus = getApiErrorStatus(privateError);
              const publicStatus = getApiErrorStatus(publicError);
              const status = publicStatus ?? privateStatus;

              if (status === 403 || privateStatus === 403) {
                setDiagramAccessState("forbidden");
              } else if (status === 404 || privateStatus === 404) {
                setDiagramAccessState("not-found");
              } else {
                setDiagramAccessState("error");
              }
            }
          }
        } catch (err) {
          if (cancelled) return;
          console.error("Failed to load diagram:", err);
          const status = getApiErrorStatus(err);
          if (!isAuthenticated && [401, 403, 404].includes(status ?? 0)) {
            setDiagramAccessState("requires-auth");
          } else if (status === 404) {
            setDiagramAccessState("not-found");
          } else {
            setDiagramAccessState("error");
          }
        }
      };

      void loadDiagramFromUrl();
      return () => {
        cancelled = true;
      };
    } else if (idFromUrl === "free" && isAuthenticated) {
      // For Design Studio: restore the last auto-saved diagram
      const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
      const lastDiagramId = localStorage.getItem(lastDiagramKey);

      if (lastDiagramId) {
        // Try to load the last auto-saved diagram
        const loadLastDiagram = async () => {
          try {
            const diagram = await apiService.getDiagram(lastDiagramId);
            const loadedNodes = diagram.nodes as Node[];
            const loadedEdges = restoreEdgePurposes(diagram.edges as Edge[]);

            // Restore icon components and ensure we have full component data
            const restoredNodes = restoreNodeIcons(loadedNodes);

            setNodes(restoredNodes);
            setEdges(restoreEdgePurposes(loadedEdges));
            setCurrentDiagramId(diagram.id);
            setCurrentDiagram(diagram);
            setRemixOrigin(null);

            // Immediately update canvas state to prevent undo/redo from clearing the loaded data
            setCanvasState({ nodes: restoredNodes, edges: loadedEdges });

            toast.success("Design restored from previous session");
          } catch (err) {
            console.error("Failed to load last diagram:", err);
            // If loading fails, remove the invalid diagram ID from localStorage
            localStorage.removeItem(lastDiagramKey);
            toast.error("Failed to restore previous design. Starting fresh.");
          }
        };

        loadLastDiagram();
      }
    } else if (idFromUrl && idFromUrl !== "free" && isAuthenticated) {
      // Load saved progress for problem-solving from database
      const loadAttempt = async () => {
        try {
          const attempt = (await apiService.getAttemptByProblem(idFromUrl)) as {
            id?: string;
            title?: string;
            difficulty?: string;
            category?: string;
            nodes: Node[];
            edges: Edge[];
            elapsedTime: number;
            lastAssessment?: ValidationResult;
            reasoningContext?: DesignReasoningContext;
            interviewSession?: InterviewSession;
            assessmentCount?: number;
            assessmentHistory?: AssessmentHistoryEntry[];
            addressedFindingIds?: string[];
            isPublic?: boolean;
          } | null;

          if (attempt) {
            persistedAssessmentCountRef.current = attempt.assessmentCount ?? 0;
            setAssessmentHistory(attempt.assessmentHistory ?? []);
            setAddressedFindingIds(attempt.addressedFindingIds ?? []);
            const loadedNodes = attempt.nodes;
            const loadedEdges = restoreEdgePurposes(attempt.edges);

            // Restore icon components and ensure we have full component data
            const restoredNodes = restoreNodeIcons(loadedNodes);

            setNodes(restoredNodes);
            setEdges(restoreEdgePurposes(loadedEdges));

            lastSavedAttemptContentRef.current = getAttemptContentSnapshot({
              problemId: idFromUrl,
              title: attempt.title || problem?.title || "Unknown Problem",
              difficulty: attempt.difficulty ?? problem?.difficulty,
              category: attempt.category ?? problem?.category,
              nodes: restoredNodes,
              edges: loadedEdges,
              reasoningContext,
              interviewSession: attempt.interviewSession ?? {
                exchanges: [],
                currentQuestionIndex: 0,
              },
            });

            // Restore timer progress if available
            if (attempt.elapsedTime) {
              setElapsedTime(attempt.elapsedTime);
            }

            // Restore last assessment if available
            if (attempt.lastAssessment) {
              setAssessment(attempt.lastAssessment);
              // Automatically open Assessment tab to show the assessment
              setActiveRightTab("assessment");
            }

            if (attempt.interviewSession) {
              setInterviewSession(attempt.interviewSession);
            }

            // Restore attempt ID so Share to the World can reference it
            if (attempt.id) {
              setSavedAttemptId(attempt.id);
            }
            setIsAttemptPublic(Boolean(attempt.isPublic));

            // Immediately update canvas state
            setCanvasState({ nodes: restoredNodes, edges: loadedEdges });

            toast.success("Progress restored from previous session");
          }
        } catch (error) {
          console.error("Failed to load saved attempt:", error);
        }
      };

      loadAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramIdFromUrl, isAuthenticated, idFromUrl, remixIdFromUrl, user?.id]);

  // Enable auto-save for authenticated users in both free mode and problem-solving mode
  useEffect(() => {
    setAutoSaveEnabled(isAuthenticated && idFromUrl !== undefined);
  }, [isAuthenticated, idFromUrl]);

  // Auto-save effect - save canvas state when diagram content changes
  useEffect(() => {
    if (!autoSaveEnabled || nodes.length === 0) return;

    const isProblemAttempt = Boolean(idFromUrl && idFromUrl !== "free");
    const attemptContentSnapshot =
      isProblemAttempt && idFromUrl
        ? getAttemptContentSnapshot({
            problemId: idFromUrl,
            title: problem?.title || "Unknown Problem",
            difficulty: problem?.difficulty,
            category: problem?.category,
            nodes,
            edges,
            reasoningContext,
            interviewSession,
            addressedFindingIds,
          })
        : null;

    // Keep elapsedTime as a dependency/trigger, but do not save when the
    // persisted attempt content has not changed since the last successful save.
    if (
      isProblemAttempt &&
      (attemptSaveInFlightRef.current ||
        attemptContentSnapshot === lastSavedAttemptContentRef.current)
    ) {
      return;
    }

    const autoSave = async () => {
      try {
        if (
          idFromUrl === "free" &&
          !currentDiagramId &&
          !userIntent?.title &&
          !userIntent?.description
        ) {
          const saveDialogDismissed =
            localStorage.getItem(SAVE_DIALOG_DISMISSED_KEY) === "true";

          if (!userDeclinedSaveRef.current && !saveDialogDismissed) {
            // No user intent - prompt for title and description (first time only)
            setShowTitleDialog(true);
            setAutoSaveStatus("idle");
          }
          // If declined, do nothing — no "saving" flash, no API call
          return;
        }

        setAutoSaveStatus("saving");

        if (idFromUrl === "free") {
          // For Design Studio: save to API as diagrams
          if (currentDiagramId) {
            // Update existing diagram
            await apiService.updateDiagram(currentDiagramId, {
              title: currentDiagram?.title || "Auto-saved Design",
              description: currentDiagram?.description || "Auto-saved design",
              nodes,
              edges,
              reasoningContext,
            });

            // Ensure the diagram ID is stored for restoration on refresh
            const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
            localStorage.setItem(lastDiagramKey, currentDiagramId);
          } else if (
            userIntent &&
            (userIntent.title || userIntent.description)
          ) {
            // First save - use chat bot's user intent for first save
            const newDiagram = await apiService.saveDiagram({
              title: userIntent.title || "Untitled Design",
              description: userIntent.description || "",
              nodes,
              edges,
              reasoningContext,
              sourceDiagramId: remixOrigin?.sourceDiagramId,
              familyId: remixOrigin?.familyId ?? undefined,
            });
            setCurrentDiagramId(newDiagram.id);
            setCurrentDiagram(newDiagram);
            setRemixOrigin(null);

            // Store the diagram ID for restoration
            const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
            localStorage.setItem(lastDiagramKey, newDiagram.id);
          }
        } else {
          // For Problem-solving: save progress to database
          if (!idFromUrl || !attemptContentSnapshot) return; // Safety check
          if (
            attemptSaveInFlightRef.current ||
            attemptContentSnapshot === lastSavedAttemptContentRef.current
          ) {
            return;
          }

          attemptSaveInFlightRef.current = true;
          try {
            await apiService.saveAttempt({
              problemId: idFromUrl,
              title: problem?.title || "Unknown Problem",
              difficulty: problem?.difficulty,
              category: problem?.category,
              nodes,
              edges,
              elapsedTime,
              reasoningContext,
              interviewSession,
              addressedFindingIds,
              // Don't save assessment in auto-save, only when assessment is explicitly run
            });
            lastSavedAttemptContentRef.current = attemptContentSnapshot;
          } finally {
            attemptSaveInFlightRef.current = false;
          }
        }

        setAutoSaveStatus("saved");
        setLastSavedAt(new Date());

        // Show toast notification for successful auto-save (only show occasionally to avoid spam)
        const lastToastTime = localStorage.getItem("lastAutoSaveToast");
        const now = Date.now();
        if (
          !lastToastTime ||
          now - Number.parseInt(lastToastTime) > 60000 // Show toast max once per minute
        ) {
          toast.success(
            idFromUrl === "free"
              ? "Design auto-saved successfully!"
              : "Progress auto-saved successfully!",
          );
          localStorage.setItem("lastAutoSaveToast", now.toString());
        }

        // Reset status after 3 seconds
        setTimeout(() => setAutoSaveStatus("idle"), 3000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setAutoSaveStatus("error");

        // Reset status after 5 seconds
        setTimeout(() => setAutoSaveStatus("idle"), 5000);
      }
    };

    // Debounce auto-save to avoid too many requests
    const timeoutId = setTimeout(autoSave, 3000); // Save after 3 seconds of inactivity

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    nodes,
    edges,
    autoSaveEnabled,
    idFromUrl,
    currentDiagramId,
    user?.id,
    elapsedTime,
    problem,
    userIntent,
    reasoningContext,
    interviewSession,
    addressedFindingIds,
    remixOrigin,
  ]);

  // Apply undo/redo state to React Flow
  useEffect(() => {
    isApplyingUndoRedo.current = true;
    setNodes(canvasState.nodes);
    setEdges(canvasState.edges);
    // Reset flag after a brief delay to allow state updates to complete
    setTimeout(() => {
      isApplyingUndoRedo.current = false;
    }, 0);
  }, [canvasState, setNodes, setEdges]);

  // Timer effect - runs continuously every second (only for problems, not free mode)
  useEffect(() => {
    if (idFromUrl === "free") return; // Don't run timer for Design Studio

    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [idFromUrl]);

  // Cleanup localStorage when user navigates away from the page
  useEffect(() => {
    return () => {
      // Remove Design Studio progress
      const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
      localStorage.removeItem(lastDiagramKey);

      // Remove problem-solving progress if applicable
      if (idFromUrl && idFromUrl !== "free") {
        const progressKey = `problem-progress-${user?.id || "anonymous"}-${idFromUrl}`;
        localStorage.removeItem(progressKey);
      }
    };
  }, [user?.id, idFromUrl]);

  // Format elapsed time as HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Format saved time - show relative time for recent saves, exact time for older ones
  const formatSavedTime = (savedAt: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor(
      (now.getTime() - savedAt.getTime()) / 1000,
    );

    if (diffInSeconds < 60) {
      return "a moment ago";
    } else if (diffInSeconds < 1800) {
      // 5 minutes
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} min ago`;
    } else if (diffInSeconds < 3600) {
      // 1 hour
      return "about an hour ago";
    } else if (diffInSeconds < 86400) {
      // 24 hours
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      // Show exact time for anything older than a day
      return `at ${savedAt.toLocaleTimeString()}`;
    }
  };

  // Close layout menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showLayoutMenu) {
        const target = e.target as HTMLElement;
        if (!target.closest(".relative")) {
          setShowLayoutMenu(false);
        }
      }
    };

    if (showLayoutMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showLayoutMenu]);

  const onConnect = (connection: Connection) => {
    if (!firstConnectionTrackedRef.current) {
      firstConnectionTrackedRef.current = true;
      trackEvent("first_connection_added", {
        problem_id: idFromUrl === "free" ? undefined : idFromUrl,
        connection_type: "default",
      });
    }

    // Determine if we're connecting field-addressable ER tables.
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    // Use the ER relationship edge for field-addressable tables; triggers,
    // notes, and other non-table nodes continue to use the generic edge.
    const isEntityNode = (node: Node | undefined) =>
      isFieldAddressableERTable(node?.data);

    const isERConnection = isEntityNode(sourceNode) && isEntityNode(targetNode);
    const getFieldIdFromHandle = (handle: string | null | undefined) => {
      if (!handle?.startsWith("field:")) return undefined;
      const lastSeparator = handle.lastIndexOf(":");
      if (lastSeparator <= "field:".length) return undefined;
      const side = handle.slice(lastSeparator + 1);
      return side === "left" || side === "right"
        ? handle.slice("field:".length, lastSeparator)
        : undefined;
    };

    const sourceFieldId = getFieldIdFromHandle(connection.sourceHandle);
    const targetFieldId = getFieldIdFromHandle(connection.targetHandle);

    // Use ER relationship edge for ER diagrams, custom edge for others
    const newEdge = {
      ...connection,
      type: isERConnection ? "erRelationship" : "customEdge",
      data: isERConnection
        ? {
            label: "",
            hasLabel: false,
            cardinality: "one-to-many",
            ...(sourceFieldId ? { sourceFieldId } : {}),
            ...(targetFieldId ? { targetFieldId } : {}),
          }
        : { label: "", hasLabel: false },
    } as unknown as Edge;
    setEdges((eds) => addEdge(newEdge, eds));
  };

  // --- Assessment state & runner (hooks must be top-level before any returns) ---
  const [assessment, setAssessment] = React.useState<ValidationResult | null>(
    null,
  );
  const [isAssessing, setIsAssessing] = useState(false);
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);
  const [showAssessmentInterview, setShowAssessmentInterview] = useState(false);
  const [assessmentInterviewQuestions, setAssessmentInterviewQuestions] =
    useState<string[]>([]);
  const [assessmentInterviewIndex, setAssessmentInterviewIndex] = useState(0);
  const [assessmentInterviewAnswer, setAssessmentInterviewAnswer] =
    useState("");
  const [assessmentInterviewSession, setAssessmentInterviewSession] =
    useState<InterviewSession>({
      exchanges: [],
      currentQuestionIndex: 0,
    });
  const executeAssessment = async (preAssessmentSession: InterviewSession) => {
    if (isAssessing) return;

    setIsAssessing(true);
    setAssessment(null);
    const solution = buildSystemDesignSolution(nodes, edges, reasoningContext);

    try {
      // Call AI assessor (now returns Promise) with problem context
      const res = await assessSolution(solution, problem, preAssessmentSession);
      const followUpSession: InterviewSession = {
        exchanges: preAssessmentSession.exchanges,
        currentQuestionIndex: 0,
      };
      setAssessment(res);
      trackEvent("assessment_completed", {
        problem_id: idFromUrl === "free" ? undefined : idFromUrl,
        assessment_source: res.source ?? "unknown",
        score_band: getAssessmentScoreBand(res.score),
        finding_count: res.feedback?.length ?? 0,
      });
      setInterviewSession(followUpSession);
      setActiveRightTab("assessment");

      // Save assessment to database for problem-solving mode
      if (idFromUrl && idFromUrl !== "free" && isAuthenticated) {
        try {
          const savedAttempt = (await apiService.saveAttempt({
            problemId: idFromUrl,
            title: problem?.title || "Unknown Problem",
            difficulty: problem?.difficulty,
            category: problem?.category,
            nodes,
            edges,
            elapsedTime,
            lastAssessment: res,
            reasoningContext,
            interviewSession: followUpSession,
            addressedFindingIds,
          })) as {
            id?: string;
            isPublic?: boolean;
            assessmentCount?: number;
            assessmentHistory?: AssessmentHistoryEntry[];
          };
          persistedAssessmentCountRef.current =
            savedAttempt.assessmentCount ?? 0;
          if (savedAttempt.assessmentHistory) {
            setAssessmentHistory(savedAttempt.assessmentHistory);
          }
          if (savedAttempt?.id) {
            setSavedAttemptId(savedAttempt.id);
          }
          if (typeof savedAttempt?.isPublic === "boolean") {
            setIsAttemptPublic(savedAttempt.isPublic);
          }

          lastSavedAttemptContentRef.current = getAttemptContentSnapshot({
            problemId: idFromUrl,
            title: problem?.title || "Unknown Problem",
            difficulty: problem?.difficulty,
            category: problem?.category,
            nodes,
            edges,
            reasoningContext,
            interviewSession: followUpSession,
            addressedFindingIds,
          });
        } catch (error) {
          console.error("Failed to save assessment:", error);
        }
      }
    } catch (error) {
      console.error("Assessment failed:", error);
      setAssessment({
        isValid: false,
        score: 0,
        feedback: [
          {
            type: "error",
            message:
              "Assessment failed. Please check your connection and try again.",
            category: "maintainability",
          },
        ],
        suggestions: [],
        missingComponents: [],
        architectureStrengths: [],
        improvements: [],
      });
    } finally {
      setIsAssessing(false);
    }
  };

  const runAssessment = async () => {
    if (isAssessing || isPreparingInterview) return;

    if (persistedAssessmentCountRef.current >= 1) {
      trackEvent("assessment_retry_started", {
        problem_id: idFromUrl === "free" ? undefined : idFromUrl,
        previous_persisted_assessment_count:
          persistedAssessmentCountRef.current,
      });
    }

    setIsPreparingInterview(true);

    try {
      const questions = await generateInterviewQuestions(
        buildSystemDesignSolution(nodes, edges, reasoningContext),
        problem,
      );
      setAssessmentInterviewQuestions(questions);
    } catch (error) {
      console.error("Failed to prepare interview questions:", error);
      setAssessmentInterviewQuestions(DEFAULT_PRE_ASSESSMENT_QUESTIONS);
    } finally {
      setAssessmentInterviewIndex(0);
      setAssessmentInterviewAnswer("");
      setAssessmentInterviewSession({
        exchanges: [],
        currentQuestionIndex: 0,
      });
      setShowAssessmentInterview(true);
      setIsPreparingInterview(false);
    }
  };

  const toggleFindingAddressed = (findingId: string) => {
    setAddressedFindingIds((current) =>
      current.includes(findingId)
        ? current.filter((id) => id !== findingId)
        : [...current, findingId],
    );
    trackEvent("assessment_finding_toggled", {
      problem_id: idFromUrl === "free" ? undefined : idFromUrl,
      finding_id: findingId,
    });
  };

  const advanceAssessmentInterview = (skipped: boolean) => {
    const question = assessmentInterviewQuestions[assessmentInterviewIndex];
    if (!question) return;

    const answer = skipped ? "" : assessmentInterviewAnswer.trim();
    if (!skipped && !answer) return;

    const exchange: InterviewExchange = {
      id: `pre-assessment-interview-${Date.now()}`,
      question,
      answer,
      critique: "",
      strengths: [],
      gaps: [],
      createdAt: new Date().toISOString(),
      skipped,
    };
    const nextIndex = assessmentInterviewIndex + 1;
    const nextSession: InterviewSession = {
      exchanges: [...assessmentInterviewSession.exchanges, exchange],
      currentQuestionIndex: nextIndex,
    };

    setAssessmentInterviewSession(nextSession);
    setAssessmentInterviewIndex(nextIndex);
    setAssessmentInterviewAnswer("");

    if (nextIndex >= assessmentInterviewQuestions.length) {
      trackEvent("reasoning_submitted", {
        problem_id: idFromUrl === "free" ? undefined : idFromUrl,
        field_count: nextSession.exchanges.filter((item) => item.answer.trim())
          .length,
        source: "assessment_interview",
      });
      setShowAssessmentInterview(false);
      void executeAssessment(nextSession);
    }
  };

  const cancelAssessmentInterview = () => {
    setShowAssessmentInterview(false);
    setAssessmentInterviewAnswer("");
  };

  // ref to the reactflow wrapper to compute drop position
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const data =
      event.dataTransfer?.getData("application/reactflow") ||
      event.dataTransfer?.getData("text/plain");
    let type = data;

    try {
      if (data) {
        const parsed = JSON.parse(data);
        type = parsed.type || data;
      }
    } catch {
      // not json, keep data as-is
    }

    // Use screenToFlowPosition to properly convert screen coordinates to flow coordinates
    // This accounts for zoom and pan transformations
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const id = `${type}-${Date.now()}`;
    const comp = COMPONENTS.find((c) => c.id === type);

    // Try to find component in minimal components (from palette - has iconUrl)
    let minimalComp: MinimalComponent | undefined = undefined;

    // Search in all cached provider components
    for (const providerComps of Object.values(minimalComponentsByProvider)) {
      minimalComp = providerComps.find((c) => c.id === type);
      if (minimalComp) break;
    }

    // Also check current minimalComponents array
    minimalComp ??= minimalComponents.find((c) => c.id === type);

    // Get full component data from cache if available (has properties)
    const fullComp = fullComponentsCache[type];

    // If not in cache and it's not a local component, trigger fetch for next time
    if (
      !fullComp &&
      type &&
      !comp &&
      minimalComp &&
      !isGenericComponentReference(type)
    ) {
      dispatch(fetchFullComponent(type));
    }

    // Use data with priority: minimalComp (from palette) > fullComp (full DB data) > comp (local config)
    const iconUrl = minimalComp?.iconUrl || fullComp?.iconUrl || comp?.iconUrl;
    const label = minimalComp?.label || fullComp?.label || comp?.label || type;
    const description =
      minimalComp?.description || fullComp?.description || comp?.description;

    // Check if it's a group/cluster component
    const isGroupComponent =
      comp?.nodeType === "group" || minimalComp?.nodeType === "group";

    // Determine node type: use component's nodeType if specified, otherwise default behavior
    const nodeTypeToUse =
      comp?.nodeType || (isGroupComponent ? "group" : "custom");

    // Defaults for freeform nodes added via drag/drop - prefer width/height from
    // the component definition (comp or minimalComp) when available. Also apply
    // property defaults (e.g., shapeType) into the node's data so properties
    // defined in `COMPONENTS` are respected on creation.
    const isFreeformNode = (nodeTypeToUse as string) === "freeform";
    const defaultW = Number(comp?.width ?? minimalComp?.width ?? 180);
    const defaultH = Number(comp?.height ?? minimalComp?.height ?? 120);
    const propList = comp?.properties ?? fullComp?.properties ?? [];
    const propDefaults = (propList || []).reduce(
      (acc: Record<string, unknown>, p) => {
        if (p.default !== undefined) acc[p.key] = p.default;
        return acc;
      },
      {} as Record<string, unknown>,
    );
    const shapeTypeFromProps =
      (propDefaults.shapeType as string | undefined) ?? undefined;
    const freeformDefault = isFreeformNode
      ? {
          style: { width: defaultW, height: defaultH },
          data: {
            shape: {
              type: shapeTypeFromProps ?? "rect",
              width: defaultW,
              height: defaultH,
            },
            ...propDefaults,
          },
        }
      : {};
    let nodeStyle: Node["style"];
    if (isGroupComponent) {
      nodeStyle = {
        width: 400,
        height: 300,
        zIndex: -1,
      };
    } else if (isFreeformNode) {
      nodeStyle = freeformDefault.style as Node["style"];
    }

    const newNode: Node = {
      id,
      position,
      type: nodeTypeToUse as unknown as Node["type"],
      // For group nodes, use different styling
      style: nodeStyle,
      // include icon so the custom node can render it
      data: {
        label: label, // Use label from priority order
        componentId: type, // Store the original component ID (the type from drag data)
        icon: comp?.icon,
        iconUrl: iconUrl, // Use iconUrl with priority order
        subtitle: description, // Use description from priority order
        backgroundColor: isGroupComponent
          ? "rgba(100, 100, 255, 0.05)"
          : undefined,
        borderColor: isGroupComponent ? "rgba(100, 100, 255, 0.3)" : undefined,
        ...(isFreeformNode
          ? (freeformDefault.data as unknown as AnyNodeData)
          : {}),
        // For table nodes, add default attributes structure and renderConfig
        ...(nodeTypeToUse === "tableNode"
          ? {
              componentName: comp?.label || "Entity",
              attributes:
                comp?.data?.attributes ||
                ([
                  {
                    id: "attr-1",
                    name: "id",
                    type: "UUID",
                    isPrimaryKey: true,
                  },
                  {
                    id: "attr-2",
                    name: "name",
                    type: "VARCHAR(100)",
                    isNullable: false,
                  },
                  {
                    id: "attr-3",
                    name: "created_at",
                    type: "TIMESTAMP",
                    isNullable: false,
                  },
                ] as TableAttribute[]),
              renderConfig: comp?.renderConfig, // Pass the renderConfig from component
            }
          : {}),
        // For erNode types, add default property values
        ...(nodeTypeToUse === "erNode"
          ? comp?.properties?.reduce(
              (acc, prop) => {
                if (prop.default !== undefined && prop.default !== "") {
                  acc[prop.key] = prop.default;
                }
                return acc;
              },
              {} as Record<string, string | number | boolean>,
            )
          : {}),
      },
    };

    setNodes((nds) => [...nds, newNode]);
  };

  // Handle node drag stop to assign parent-child relationships with groups
  const onNodeDragStop = (_event: React.MouseEvent, node: Node) => {
    // Only allow attaching nodes to groups, NOT detaching
    // Detachment can only be done via the explicit detach buttons

    // Skip if node already has a parent - they can only detach via buttons
    if (node.parentId) return;

    // Find if the node is being dragged over a group node
    const groupNodes = nodes.filter((n) => n.type === "group");

    // Check if node is inside any group
    let newParentId: string | undefined = undefined;

    for (const groupNode of groupNodes) {
      if (groupNode.id === node.id) continue; // Skip if dragging the group itself

      const groupX = groupNode.position.x;
      const groupY = groupNode.position.y;
      const groupWidth = (groupNode.style?.width as number) || 400;
      const groupHeight = (groupNode.style?.height as number) || 300;

      // Get absolute position of the node
      const nodeAbsX = node.position.x;
      const nodeAbsY = node.position.y;

      // Check if node is within group bounds (with some padding for better UX)
      const padding = 10;
      if (
        nodeAbsX > groupX + padding &&
        nodeAbsX < groupX + groupWidth - padding &&
        nodeAbsY > groupY + padding &&
        nodeAbsY < groupY + groupHeight - padding
      ) {
        newParentId = groupNode.id;
        break;
      }
    }

    // Only attach if we found a new parent
    if (newParentId) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            // Calculate position relative to the new parent
            const newParent = nds.find((gn) => gn.id === newParentId);
            const newPosition = newParent
              ? {
                  x: node.position.x - newParent.position.x,
                  y: node.position.y - newParent.position.y,
                }
              : node.position;

            return {
              ...n,
              position: newPosition,
              parentId: newParentId,
              extent: "parent" as const,
            };
          }
          return n;
        }),
      );
    }
  };

  // Handle detaching a node from its parent group
  const handleDetachFromGroup = useCallback(() => {
    const nodeId = inspectedNodeIdRef.current;
    if (!nodeId) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId && n.parentId) {
          // Calculate absolute position before detaching
          const parent = nds.find((p) => p.id === n.parentId);
          let absX = n.position.x;
          let absY = n.position.y;

          if (parent) {
            absX += parent.position.x;
            absY += parent.position.y;
          }

          return {
            ...n,
            position: { x: absX, y: absY },
            parentId: undefined,
            extent: undefined,
          };
        }
        return n;
      }),
    );
  }, [setNodes]);

  // inspector state
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [inspectedEdgeId, setInspectedEdgeId] = useState<string | null>(null);
  type NodeProps = Record<string, string | number | boolean | undefined>;
  const [nodeProps, setNodeProps] = useState<NodeProps>({});
  type EdgeProps = Record<string, string | number | boolean | undefined>;
  const [edgeProps, setEdgeProps] = useState<EdgeProps>({});
  // Custom properties state - stores custom properties per node
  const [customProperties, setCustomProperties] = useState<
    Record<string, CustomProperty[]>
  >({});
  // ── Guided walkthrough: apply a step to the canvas ──────────────────────────
  const allMinimalComponents = useSelector((state: RootState) =>
    Object.values(state.components.minimalComponentsByProvider).flat(),
  );

  const handleApplyStep = React.useCallback(
    (step: GuidedStep) => {
      if (step.type === "add_component" && step.component) {
        const comp = step.component;
        // Skip if a node with this ID already exists
        if (nodesRef.current.some((n) => n.id === comp.nodeId)) return;
        // Look up icon from the Redux component library and local config
        const libraryComp = allMinimalComponents.find(
          (c) => c.id === comp.componentType,
        );
        const localCompDef = COMPONENTS.find(
          (c) => c.id === comp.componentType,
        );
        const fullComp = fullComponentsCache[comp.componentType];

        const isGroupComponent =
          localCompDef?.nodeType === "group" || fullComp?.nodeType === "group";
        const resolvedNodeType =
          localCompDef?.nodeType || (isGroupComponent ? "group" : "custom");

        // const newNode: Node = {
        //   id: comp.nodeId,
        //   position: comp.position,
        //   type: resolvedNodeType,
        //   data: {
        //     label: comp.label,
        //     componentId: comp.componentType,
        //     // Prefer local React icon, fall back to provided iconUrl (minimal/full)
        //     icon: localCompDef?.icon ?? fullComp?.icon,
        //     iconUrl:
        //       comp.iconUrl ?? libraryComp?.iconUrl ?? fullComp?.data?.iconUrl,
        //     subtitle: comp.description ?? comp.highlightReason,
        //     // Flatten guided step properties onto node.data so the Inspector can read them
        //     ...Object.fromEntries(
        //       Object.entries(comp.properties).map(([k, v]) => [k, v]),
        //     ),
        //   },
        // };/

        const newNode: Node = {
          id: comp.nodeId,
          position: comp.position,
          type: resolvedNodeType,
          // For group nodes, use different styling
          style: isGroupComponent
            ? {
                width: 400,
                height: 300,
                zIndex: -1, // Groups should be behind regular nodes
              }
            : undefined,
          // include icon so the custom node can render it
          data: {
            // Spread guided step properties first so the Inspector and
            // assessment service can read purpose, auth settings, etc.
            // Explicit fields below take precedence over anything in properties.
            ...(() => {
              const guidedProperties = { ...comp.properties } as Record<
                string,
                unknown
              >;
              const guidedSchema = normalizeComponentProperties(
                localCompDef?.properties ?? fullComp?.properties ?? [],
              );
              if (guidedSchema.some((property) => property.key === "purpose")) {
                if (
                  guidedProperties.purpose === undefined &&
                  guidedProperties.description !== undefined
                ) {
                  guidedProperties.purpose = guidedProperties.description;
                }
                delete guidedProperties.description;
              }
              return guidedProperties;
            })(),
            label: comp.label, // Use label from priority order
            componentId: comp.componentType, // Store the original component ID (the type from drag data)
            icon: localCompDef?.icon,
            iconUrl:
              localCompDef?.iconUrl ??
              libraryComp?.iconUrl ??
              fullComp?.data?.iconUrl, // Use iconUrl with priority order
            subtitle: comp.description ?? comp.highlightReason, // Use description from priority order
            backgroundColor: isGroupComponent
              ? "rgba(100, 100, 255, 0.05)"
              : undefined,
            borderColor: isGroupComponent
              ? "rgba(100, 100, 255, 0.3)"
              : undefined,
            // For table nodes, add default attributes structure and renderConfig
            ...(resolvedNodeType === "tableNode"
              ? {
                  componentName: comp?.label || "Entity",
                  attributes:
                    comp?.data?.attributes || ([] as TableAttribute[]),
                  renderConfig: localCompDef?.renderConfig, // Pass the renderConfig from component
                }
              : {}),
            // For erNode types, add default property values
            ...(resolvedNodeType === "erNode"
              ? localCompDef?.properties?.reduce(
                  (acc, prop) => {
                    if (prop.default !== undefined && prop.default !== "") {
                      acc[prop.key] = prop.default;
                    }
                    return acc;
                  },
                  {} as Record<string, string | number | boolean>,
                )
              : {}),
          },
        };

        // Ensure full component metadata is fetched if it's a provider component
        if (
          comp.componentType &&
          !COMPONENTS.find((c) => c.id === comp.componentType) &&
          !fullComponentsCache[comp.componentType] &&
          !isGenericComponentReference(comp.componentType)
        ) {
          dispatch(fetchFullComponent(comp.componentType));
        }

        setNodes((nds) => [...nds, newNode]);
      } else if (step.type === "add_connection" && step.connection) {
        const conn = step.connection;
        const newEdge = {
          id: conn.edgeId,
          source: conn.sourceNodeId,
          sourceHandle: "right",
          target: conn.targetNodeId,
          targetHandle: "left",
          type: "customEdge",
          data: {
            label: conn.label,
            purpose: conn?.description ?? "",
            hasLabel: true,
          },
        } as Edge;
        setEdges((eds) => addEdge(newEdge, eds));
      }
    },
    [setNodes, setEdges, allMinimalComponents, dispatch, fullComponentsCache],
  );

  // which tab is active in the right sidebar: 'details' or 'inspector'
  const [activeRightTab, setActiveRightTab] = useState<
    "details" | "inspector" | "assessment" | "guide"
  >("details");
  // Preserve guided walkthrough step index across tab switches
  const [guideCurrentStep, setGuideCurrentStep] = useState<number>(0);
  // Clear canvas confirmation state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // When true, also remove any persisted progress (local or server) on confirm
  const [clearSavedOnConfirm, setClearSavedOnConfirm] = useState(false);

  // ref to hold latest inspectedNodeId for event handlers to read without adding deps
  const inspectedNodeIdRef = useRef<string | null>(null);
  React.useEffect(() => {
    inspectedNodeIdRef.current = inspectedNodeId;
  }, [inspectedNodeId]);

  // handlers moved outside the effect to reduce nesting depth. Use refs to keep stable references.
  const handleDiagramNodeDeleteRef = useRef<((e: Event) => void) | undefined>(
    undefined,
  );
  handleDiagramNodeDeleteRef.current = (e: Event) => {
    const ce = e as CustomEvent;
    const id: string = ce.detail.id;
    setNodes((nds) => nds.filter((n) => n.id !== id));
    if (inspectedNodeIdRef.current === id) {
      setInspectedNodeId(null);
      setActiveRightTab("details");
    }
  };

  const handleDiagramNodeToggleRef = useRef<((e: Event) => void) | undefined>(
    undefined,
  );
  handleDiagramNodeToggleRef.current = (e: Event) => {
    const ce = e as CustomEvent;
    const id: string = ce.detail.id;
    setInspectedNodeId((curr) => {
      const next = curr === id ? null : id;
      if (next) {
        setInspectedEdgeId(null); // clear edge when node selected
        setActiveRightTab("inspector");
      } else setActiveRightTab("details");
      return next;
    });
  };

  const handleDiagramTableCollapseToggleRef = useRef<
    ((e: Event) => void) | undefined
  >(undefined);
  handleDiagramTableCollapseToggleRef.current = (e: Event) => {
    const ce = e as CustomEvent<{ id: string }>;
    const nodeId = ce.detail.id;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id !== nodeId || !isContentSizedTableNode(node.data)) {
          return node;
        }

        const nodeData = (node.data ?? {}) as Record<string, unknown>;
        return {
          ...node,
          data: {
            ...nodeData,
            isCollapsed: nodeData.isCollapsed !== true,
          },
        };
      }),
    );
  };

  function updateEdgeLabel(
    eds: Edge[],
    id: string,
    label: string,
    hasLabel: boolean,
  ) {
    return eds.map((edge) =>
      edge.id === id
        ? { ...edge, data: { ...edge.data, label, hasLabel }, label }
        : edge,
    );
  }

  function updateEdgeCardinality(eds: Edge[], id: string, cardinality: string) {
    return eds.map((edge) =>
      edge.id === id ? { ...edge, data: { ...edge.data, cardinality } } : edge,
    );
  }

  const updateEdgeProperty = useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      setEdgeProps((prev) => ({ ...prev, [key]: value }));
      setEdges((eds) =>
        eds.map((e) =>
          e.id === inspectedEdgeId
            ? { ...e, data: { ...e.data, [key]: value } }
            : e,
        ),
      );
    },
    [inspectedEdgeId, setEdges],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setInspectedEdgeId(edge.id);
      setInspectedNodeId(null);
      const d = (edge.data || {}) as EdgeProps;
      const normalizedData = normalizeEdgeDataPurpose(d);
      setEdgeProps(normalizedData as EdgeProps);
      setEdges((eds) =>
        eds.map((currentEdge) =>
          currentEdge.id === edge.id
            ? { ...currentEdge, data: normalizedData }
            : currentEdge,
        ),
      );
      setActiveRightTab("inspector");
    },
    [setEdges],
  );

  const edgeLabelChangeHandlerRef = React.useRef<
    ((e: Event) => void) | undefined
  >(undefined);
  edgeLabelChangeHandlerRef.current = (e: Event) => {
    const ce = e as CustomEvent;
    const { id, label, hasLabel } = ce.detail as {
      id: string;
      label: string;
      hasLabel: boolean;
    };
    setEdges((eds) => updateEdgeLabel(eds, id, label, hasLabel));
  };

  const edgeCardinalityChangeHandlerRef = React.useRef<
    ((e: Event) => void) | undefined
  >(undefined);
  edgeCardinalityChangeHandlerRef.current = (e: Event) => {
    const ce = e as CustomEvent;
    const { id, cardinality } = ce.detail as {
      id: string;
      cardinality: string;
    };
    setEdges((eds) => updateEdgeCardinality(eds, id, cardinality));
  };

  React.useEffect(() => {
    const listener = (e: Event) => edgeLabelChangeHandlerRef.current?.(e);
    const cardinalityListener = (e: Event) =>
      edgeCardinalityChangeHandlerRef.current?.(e);

    globalThis.addEventListener(
      "diagram:edge-label-change",
      listener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:edge-cardinality-change",
      cardinalityListener as EventListener,
    );

    return () => {
      globalThis.removeEventListener(
        "diagram:edge-label-change",
        listener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:edge-cardinality-change",
        cardinalityListener as EventListener,
      );
    };
  }, []);

  // register window event listeners once (mount/unmount)
  React.useEffect(() => {
    const deleteListener = (e: Event) =>
      handleDiagramNodeDeleteRef.current?.(e);
    const toggleListener = (e: Event) =>
      handleDiagramNodeToggleRef.current?.(e);
    const collapseToggleListener = (e: Event) =>
      handleDiagramTableCollapseToggleRef.current?.(e);
    const detachListener = (e: Event) => {
      const evt = e as CustomEvent<{ id: string }>;
      // Detach the node from its parent group
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === evt.detail.id && n.parentId) {
            // Calculate absolute position before detaching
            const parent = nds.find((p) => p.id === n.parentId);
            let absX = n.position.x;
            let absY = n.position.y;

            if (parent) {
              absX += parent.position.x;
              absY += parent.position.y;
            }

            return {
              ...n,
              position: { x: absX, y: absY },
              parentId: undefined,
              extent: undefined,
            };
          }
          return n;
        }),
      );
    };

    globalThis.addEventListener(
      "diagram:node-delete",
      deleteListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:node-toggle",
      toggleListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:table-collapse-toggle",
      collapseToggleListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:node-detach",
      detachListener as EventListener,
    );
    // Listen for freeform node resize events emitted by NodeResizer onResizeEnd
    const resizeListener = (e: Event) => {
      const evt = e as CustomEvent<{
        id: string;
        width: number;
        height: number;
      }>;
      const { id: nodeId, width, height } = evt.detail;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const updated: Node = {
            ...n,
            style: { ...(n.style ?? {}), width, height },
            data: {
              ...(n.data as AnyNodeData),
              shape: {
                ...((n.data as AnyNodeData)?.shape as
                  | Record<string, unknown>
                  | undefined),
                width,
                height,
              },
            },
          };
          return updated;
        }),
      );
    };
    globalThis.addEventListener(
      "diagram:node-resize",
      resizeListener as EventListener,
    );
    const bringToFrontListener = (e: Event) => {
      const evt = e as CustomEvent<{ id: string }>;
      const nodeId = evt.detail.id;
      setNodes((nds) => {
        const idx = nds.findIndex((n) => n.id === nodeId);
        if (idx === -1) return nds;
        const node = nds[idx];
        const others = nds.slice(0, idx).concat(nds.slice(idx + 1));
        const newOrder = [...others, node];
        return newOrder.map((n, i) => ({
          ...n,
          style: { ...(n.style ?? {}), zIndex: i },
        }));
      });
    };

    const sendToBackListener = (e: Event) => {
      const evt = e as CustomEvent<{ id: string }>;
      const nodeId = evt.detail.id;
      setNodes((nds) => {
        const idx = nds.findIndex((n) => n.id === nodeId);
        if (idx === -1) return nds;
        const node = nds[idx];
        const others = nds.slice(0, idx).concat(nds.slice(idx + 1));
        const newOrder = [node, ...others];
        return newOrder.map((n, i) => ({
          ...n,
          style: { ...(n.style ?? {}), zIndex: i },
        }));
      });
    };

    globalThis.addEventListener(
      "diagram:node-to-front",
      bringToFrontListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:node-to-back",
      sendToBackListener as EventListener,
    );
    return () => {
      globalThis.removeEventListener(
        "diagram:node-delete",
        deleteListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:node-toggle",
        toggleListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:table-collapse-toggle",
        collapseToggleListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:node-detach",
        detachListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:node-resize",
        resizeListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:node-to-front",
        bringToFrontListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:node-to-back",
        sendToBackListener as EventListener,
      );
    };
  }, [setNodes]);

  // Table node attribute event handlers
  React.useEffect(() => {
    // Helper to parse attributes from node data
    const parseAttributes = (
      attrs: TableAttribute[] | string | undefined,
    ): TableAttribute[] => {
      if (!attrs) return [];
      if (Array.isArray(attrs)) return attrs;
      if (typeof attrs === "string") {
        try {
          const parsed = JSON.parse(attrs);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const addAttributeListener = (e: Event) => {
      const evt = e as CustomEvent<{
        nodeId: string;
        attribute: TableAttribute;
      }>;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === evt.detail.nodeId) {
            const data = n.data as TableNodeData;
            const currentAttrs = parseAttributes(data.attributes);
            return {
              ...n,
              data: {
                ...data,
                attributes: [...currentAttrs, evt.detail.attribute],
              },
            };
          }
          return n;
        }),
      );
    };

    const deleteAttributeListener = (e: Event) => {
      const evt = e as CustomEvent<{ nodeId: string; attributeId: string }>;
      const fieldHandlePrefix = `field:${evt.detail.attributeId}:`;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === evt.detail.nodeId) {
            const data = n.data as TableNodeData;
            const currentAttrs = parseAttributes(data.attributes);
            return {
              ...n,
              data: {
                ...data,
                attributes: currentAttrs.filter(
                  (attr) => attr.id !== evt.detail.attributeId,
                ),
              },
            };
          }
          return n;
        }),
      );
      setEdges((eds) =>
        eds.filter((edge) => {
          const data = (edge.data ?? {}) as {
            sourceFieldId?: unknown;
            targetFieldId?: unknown;
          };
          const sourceMatches =
            edge.source === evt.detail.nodeId &&
            ((typeof edge.sourceHandle === "string" &&
              edge.sourceHandle.startsWith(fieldHandlePrefix)) ||
              data.sourceFieldId === evt.detail.attributeId);
          const targetMatches =
            edge.target === evt.detail.nodeId &&
            ((typeof edge.targetHandle === "string" &&
              edge.targetHandle.startsWith(fieldHandlePrefix)) ||
              data.targetFieldId === evt.detail.attributeId);
          return !sourceMatches && !targetMatches;
        }),
      );
    };

    const toggleAttributeListener = (e: Event) => {
      const evt = e as CustomEvent<{
        nodeId: string;
        attributeId: string;
        key: string;
      }>;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === evt.detail.nodeId) {
            const data = n.data as TableNodeData;
            const currentAttrs = parseAttributes(data.attributes);
            return {
              ...n,
              data: {
                ...data,
                attributes: currentAttrs.map((attr) =>
                  attr.id === evt.detail.attributeId
                    ? {
                        ...attr,
                        [evt.detail.key]:
                          !attr[evt.detail.key as keyof TableAttribute],
                      }
                    : attr,
                ),
              },
            };
          }
          return n;
        }),
      );
    };

    const updateAttributeListener = (e: Event) => {
      const evt = e as CustomEvent<{
        nodeId: string;
        attributeId: string;
        name: string;
        type: string;
      }>;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === evt.detail.nodeId) {
            const data = n.data as TableNodeData;
            const currentAttrs = parseAttributes(data.attributes);
            return {
              ...n,
              data: {
                ...data,
                attributes: currentAttrs.map((attr) =>
                  attr.id === evt.detail.attributeId
                    ? { ...attr, name: evt.detail.name, type: evt.detail.type }
                    : attr,
                ),
              },
            };
          }
          return n;
        }),
      );
    };

    globalThis.addEventListener(
      "diagram:table-attribute-add",
      addAttributeListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:table-attribute-delete",
      deleteAttributeListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:table-attribute-toggle",
      toggleAttributeListener as EventListener,
    );
    globalThis.addEventListener(
      "diagram:table-attribute-update",
      updateAttributeListener as EventListener,
    );

    return () => {
      globalThis.removeEventListener(
        "diagram:table-attribute-add",
        addAttributeListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:table-attribute-delete",
        deleteAttributeListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:table-attribute-toggle",
        toggleAttributeListener as EventListener,
      );
      globalThis.removeEventListener(
        "diagram:table-attribute-update",
        updateAttributeListener as EventListener,
      );
    };
  }, [setEdges, setNodes]);

  React.useEffect(() => {
    if (!inspectedNodeId) return;
    const n = nodes.find((x) => x.id === inspectedNodeId);

    // Filter out numeric keys and _customProperties when loading nodeProps
    const nodeData = (n?.data ?? {}) as NodeProps;
    const filteredData = Object.fromEntries(
      Object.entries(nodeData).filter(([key]) => {
        return Number.isNaN(Number(key)) && key !== "_customProperties";
      }),
    );

    setNodeProps(filteredData);
  }, [inspectedNodeId, nodes]);

  // --- Helpers to reduce nested function depth in JSX ---
  const updateNodeProperty = (
    key: string,
    value: string | number | boolean,
  ) => {
    // Prevent unnecessary updates
    if (nodeProps[key] === value) return;

    setNodeProps((s) => {
      const updated = { ...s, [key]: value };
      if (key === "purpose") delete updated.description;
      return updated;
    });
    // Auto-save property changes to node data
    if (inspectedNodeId) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== inspectedNodeId) return n;
          const data = { ...n.data, [key]: value } as Record<string, unknown>;
          if (key === "purpose") delete data.description;
          return { ...n, data };
        }),
      );
    }
  };

  const setPropBoolean = (key: string, value: boolean) =>
    updateNodeProperty(key, value);
  const setPropNumber = (key: string, value: number) =>
    updateNodeProperty(key, value);
  const setPropString = (key: string, value: string) =>
    updateNodeProperty(key, value);
  const setPropSelect = (key: string, value: string) =>
    updateNodeProperty(key, value);

  // --- Custom Property Handlers ---
  const handleAddCustomProperty = () => {
    if (!inspectedNodeId) return;

    const newProperty: CustomProperty = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      key: `customProperty${(customProperties[inspectedNodeId]?.length || 0) + 1}`,
      label: `Custom Property ${(customProperties[inspectedNodeId]?.length || 0) + 1}`,
      type: "text",
      value: "",
    };

    setCustomProperties((prev) => {
      const updated = {
        ...prev,
        [inspectedNodeId]: [...(prev[inspectedNodeId] || []), newProperty],
      };

      // Save to node data
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectedNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  _customProperties: updated[inspectedNodeId],
                },
              }
            : n,
        ),
      );

      return updated;
    });
  };

  const handleUpdateCustomProperty = (
    id: string,
    updates: Partial<CustomProperty>,
  ) => {
    if (!inspectedNodeId) return;

    setCustomProperties((prev) => {
      const nodeCustomProps = prev[inspectedNodeId] || [];
      const updated = nodeCustomProps.map((prop) =>
        prop.id === id ? { ...prop, ...updates } : prop,
      );

      // Save to node data
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectedNodeId
            ? { ...n, data: { ...n.data, _customProperties: updated } }
            : n,
        ),
      );

      return {
        ...prev,
        [inspectedNodeId]: updated,
      };
    });
  };

  const handleDeleteCustomProperty = (id: string) => {
    if (!inspectedNodeId) return;

    setCustomProperties((prev) => {
      const nodeCustomProps = prev[inspectedNodeId] || [];
      const filtered = nodeCustomProps.filter((prop) => prop.id !== id);

      // Save to node data
      setNodes((nds) =>
        nds.map((n) =>
          n.id === inspectedNodeId
            ? { ...n, data: { ...n.data, _customProperties: filtered } }
            : n,
        ),
      );

      return {
        ...prev,
        [inspectedNodeId]: filtered,
      };
    });
  };

  // Load custom properties when inspecting a node
  React.useEffect(() => {
    if (!inspectedNodeId) return;
    const node = nodes.find((n) => n.id === inspectedNodeId);
    if (node?.data?._customProperties) {
      setCustomProperties((prev) => ({
        ...prev,
        [inspectedNodeId]: node.data._customProperties as CustomProperty[],
      }));
    }
  }, [inspectedNodeId, nodes]);

  const renderProperty = (p: ComponentProperty) => {
    const inputId = `${inspectedNodeId}-${p.key}`;
    const raw =
      p.key === "purpose"
        ? (nodeProps.purpose ?? nodeProps.description)
        : nodeProps[p.key];
    const placeholder =
      p.key === "purpose" ? PURPOSE_PLACEHOLDER : p.placeholder;

    // coerce values to types expected by inputs (avoid nested ternary expressions)
    let numberValue: number | undefined;
    if (typeof raw === "number") {
      numberValue = raw;
    } else if (typeof p.default === "number") {
      numberValue = p.default;
    } else {
      numberValue = undefined;
    }

    let stringValue: string;
    if (typeof raw === "string") {
      stringValue = raw;
    } else if (p.default === null || p.default === undefined) {
      stringValue = "";
    } else {
      stringValue = String(p.default);
    }

    let selectValue: string | undefined;
    if (typeof raw === "string") {
      selectValue = raw;
    } else if (p.default === null || p.default === undefined) {
      selectValue = undefined;
    } else {
      selectValue = String(p.default);
    }

    const checkedValue: boolean = Boolean(raw);

    return (
      <div key={p.key} className="flex min-w-0 flex-col px-1">
        {p.type === "boolean" && (
          <AnimatedCheckbox
            id={inputId}
            checked={checkedValue}
            onChange={(val) => setPropBoolean(p.key, val)}
            label={p.label}
          />
        )}
        {p.type === "number" && (
          <AnimatedNumberInput
            id={inputId}
            label={p.label}
            value={numberValue}
            onChange={(val) => setPropNumber(p.key, val)}
          />
        )}
        {p.type === "text" && (
          <AnimatedTextInput
            id={inputId}
            label={p.label}
            value={stringValue}
            placeholder={placeholder}
            onChange={(val) => setPropString(p.key, val)}
          />
        )}
        {p.type === "textarea" && (
          <AnimatedTextarea
            id={inputId}
            label={p.label}
            value={stringValue}
            placeholder={placeholder}
            onChange={(v) => setPropString(p.key, v)}
          />
        )}
        {p.type === "select" && (
          <AnimatedSelect
            id={inputId}
            label={p.label}
            value={selectValue}
            options={p.options || []}
            onChange={(v) => setPropSelect(p.key, v)}
          />
        )}
        {p.type === "color" &&
          (() => {
            const colorPresets = [
              // Row 1 — neutrals & cool
              {
                value: "",
                label: "Default",
                bg: "transparent",
                border: "#9ca3af",
                crossed: true,
              },
              {
                value: "#ffffff",
                label: "White",
                bg: "#ffffff",
                border: "#d1d5db",
              },
              {
                value: "#f3f4f6",
                label: "Light Gray",
                bg: "#f3f4f6",
                border: "#d1d5db",
              },
              {
                value: "#dbeafe",
                label: "Light Blue",
                bg: "#dbeafe",
                border: "#93c5fd",
              },
              {
                value: "#dcfce7",
                label: "Light Green",
                bg: "#dcfce7",
                border: "#86efac",
              },
              // Row 2 — warm
              {
                value: "#fef3c7",
                label: "Light Yellow",
                bg: "#fef3c7",
                border: "#fcd34d",
              },
              {
                value: "#ffedd5",
                label: "Light Orange",
                bg: "#ffedd5",
                border: "#fdba74",
              },
              {
                value: "#fce7f3",
                label: "Light Pink",
                bg: "#fce7f3",
                border: "#f9a8d4",
              },
              {
                value: "#ede9fe",
                label: "Light Purple",
                bg: "#ede9fe",
                border: "#c4b5fd",
              },
              {
                value: "#f1f5f9",
                label: "Slate",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              },
            ];
            return (
              <div className="flex flex-col gap-2">
                <label htmlFor={inputId} className="text-xs text-muted">
                  {p.label}
                </label>
                {/* Preset swatches */}
                <div className="flex flex-wrap gap-1.5">
                  {colorPresets.map((preset) => {
                    const isSelected = stringValue === preset.value;
                    return (
                      <button
                        key={preset.value || "__default__"}
                        type="button"
                        data-tooltip={preset.label}
                        onClick={() => setPropString(p.key, preset.value)}
                        className="w-6 h-6 rounded flex-shrink-0 transition-transform hover:scale-110 relative"
                        style={{
                          backgroundColor: preset.bg,
                          border: isSelected
                            ? `2px solid #6366f1`
                            : `1.5px solid ${preset.border}`,
                          boxShadow: isSelected
                            ? "0 0 0 1px #6366f1"
                            : undefined,
                        }}
                      >
                        {preset.crossed && (
                          <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] leading-none">
                            ✕
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Custom color row */}
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id={inputId}
                    value={stringValue || "#ffffff"}
                    onChange={(e) => setPropString(p.key, e.target.value)}
                    className="w-7 h-7 cursor-pointer rounded border border-theme bg-transparent flex-shrink-0"
                    style={{ padding: "1px" }}
                    aria-label="Custom color"
                    data-tooltip="Custom color"
                  />
                  <input
                    type="text"
                    value={stringValue}
                    placeholder={p.placeholder || "#rrggbb or rgba(…)"}
                    onChange={(e) => setPropString(p.key, e.target.value)}
                    className="flex-1 text-xs bg-transparent border border-theme rounded px-2 py-1 text-theme min-w-0"
                  />
                </div>
              </div>
            );
          })()}
      </div>
    );
  };

  // compute property elements once to avoid inline IIFE and deep nesting inside JSX
  let propertyElements: React.ReactNode = null;
  if (inspectedNodeId) {
    const node = nodes.find((n) => n.id === inspectedNodeId);
    if (node) {
      // Find the component definition using componentId or label
      const comp = node.data.componentId
        ? COMPONENTS.find((c) => c.id === node.data.componentId)
        : COMPONENTS.find((c) => c.label === node.data.label);

      // Check Redux cache for full component data (includes properties from API)
      const componentId =
        typeof node.data.componentId === "string"
          ? node.data.componentId
          : null;
      const fullComp = componentId ? fullComponentsCache[componentId] : null;

      // Use properties from Redux cache (priority) or local COMPONENTS.
      // Mermaid imports also expose their visible subtitle directly, including
      // generic nodes that do not have a catalog component definition.
      const componentProperties = normalizeComponentProperties(
        fullComp?.properties || comp?.properties || [],
      );
      const subtitleProperty: ComponentProperty = {
        key: "subtitle",
        label: "Subtitle",
        type: "text",
        placeholder: "Describe this component",
        default: "Microservice",
      };
      const labelProperty: ComponentProperty = {
        key: "label",
        label: "Label",
        type: "text",
        placeholder: "Name this component",
        default: "Component",
      };
      const isGenericMermaidNode =
        node.data.extensionSource === "mermaid" && !componentId;
      const extensionProperties: ComponentProperty[] = [
        ...(isGenericMermaidNode ? [labelProperty] : []),
        ...(node.data.extensionSource === "mermaid" ? [subtitleProperty] : []),
      ];
      const properties = [
        ...componentProperties,
        ...extensionProperties.filter(
          (extensionProperty) =>
            !componentProperties.some(
              (property) => property.key === extensionProperty.key,
            ),
        ),
      ];

      if (properties && properties.length > 0) {
        propertyElements = properties
          .filter((p: ComponentProperty) => !p.hidden)
          .map((p: ComponentProperty) => renderProperty(p));
      } else {
        propertyElements = (
          <div className="text-sm text-muted">No properties defined</div>
        );
      }

      // Universal Appearance section for all non-group nodes
      if (node.type !== "group") {
        const pairedPresets = [
          { label: "Default", bg: "", border: "", text: "" },
          { label: "White", bg: "#ffffff", border: "#d1d5db", text: "#374151" },
          {
            label: "Light Gray",
            bg: "#f3f4f6",
            border: "#9ca3af",
            text: "#374151",
          },
          {
            label: "Light Blue",
            bg: "#dbeafe",
            border: "#60a5fa",
            text: "#1e3a5f",
          },
          {
            label: "Light Green",
            bg: "#dcfce7",
            border: "#4ade80",
            text: "#14532d",
          },
          {
            label: "Light Yellow",
            bg: "#fef3c7",
            border: "#f59e0b",
            text: "#78350f",
          },
          {
            label: "Light Orange",
            bg: "#ffedd5",
            border: "#fb923c",
            text: "#7c2d12",
          },
          {
            label: "Light Pink",
            bg: "#fce7f3",
            border: "#f472b6",
            text: "#831843",
          },
          {
            label: "Light Purple",
            bg: "#ede9fe",
            border: "#a78bfa",
            text: "#4c1d95",
          },
          { label: "Slate", bg: "#f1f5f9", border: "#94a3b8", text: "#1e293b" },
        ];
        const currentBg = (nodeProps["backgroundColor"] as string) || "";
        const currentBorder = (nodeProps["borderColor"] as string) || "";
        const currentText = (nodeProps["textColor"] as string) || "";
        const applyPair = (bg: string, border: string, text: string) => {
          updateNodeProperty("backgroundColor", bg);
          updateNodeProperty("borderColor", border);
          updateNodeProperty("textColor", text);
        };
        propertyElements = (
          <>
            {propertyElements}
            <div className="flex flex-col gap-3 px-1 mt-3 pt-3 border-t border-theme/20">
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                Appearance
              </div>
              {/* Paired presets */}
              <div className="flex flex-wrap gap-1.5">
                {pairedPresets.map((preset) => {
                  const isSelected =
                    currentBg === preset.bg && currentBorder === preset.border;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      data-tooltip={preset.label}
                      onClick={() =>
                        applyPair(preset.bg, preset.border, preset.text)
                      }
                      className="w-6 h-6 rounded flex-shrink-0 transition-transform hover:scale-110 relative"
                      style={{
                        backgroundColor: preset.bg || "transparent",
                        border: isSelected
                          ? "2px solid #6366f1"
                          : `1.5px solid ${preset.border || "#9ca3af"}`,
                        boxShadow: isSelected ? "0 0 0 1px #6366f1" : undefined,
                      }}
                    >
                      {!preset.bg && (
                        <span className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px] leading-none">
                          ✕
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Custom pickers */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted w-14 flex-shrink-0">
                    Fill
                  </span>
                  <input
                    type="color"
                    value={currentBg || "#ffffff"}
                    onChange={(e) =>
                      updateNodeProperty("backgroundColor", e.target.value)
                    }
                    className="w-7 h-7 cursor-pointer rounded border border-theme bg-transparent flex-shrink-0"
                    style={{ padding: "1px" }}
                  />
                  <input
                    type="text"
                    value={currentBg}
                    placeholder="#rrggbb or rgba(…)"
                    onChange={(e) =>
                      updateNodeProperty("backgroundColor", e.target.value)
                    }
                    className="flex-1 text-xs bg-transparent border border-theme rounded px-2 py-1 text-theme min-w-0"
                  />
                  {currentBg && (
                    <button
                      type="button"
                      onClick={() => updateNodeProperty("backgroundColor", "")}
                      className="text-muted hover:text-red-500 text-xs flex-shrink-0"
                      aria-label="Clear background color"
                      data-tooltip="Clear"
                      data-tooltip-placement="left"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted w-14 flex-shrink-0">
                    Border
                  </span>
                  <input
                    type="color"
                    value={currentBorder || "#ffffff"}
                    onChange={(e) =>
                      updateNodeProperty("borderColor", e.target.value)
                    }
                    className="w-7 h-7 cursor-pointer rounded border border-theme bg-transparent flex-shrink-0"
                    style={{ padding: "1px" }}
                  />
                  <input
                    type="text"
                    value={currentBorder}
                    placeholder="#rrggbb or rgba(…)"
                    onChange={(e) =>
                      updateNodeProperty("borderColor", e.target.value)
                    }
                    className="flex-1 text-xs bg-transparent border border-theme rounded px-2 py-1 text-theme min-w-0"
                  />
                  {currentBorder && (
                    <button
                      type="button"
                      onClick={() => updateNodeProperty("borderColor", "")}
                      className="text-muted hover:text-red-500 text-xs flex-shrink-0"
                      aria-label="Clear border color"
                      data-tooltip="Clear"
                      data-tooltip-placement="left"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted w-14 flex-shrink-0">
                    Text
                  </span>
                  <input
                    type="color"
                    value={currentText || "#374151"}
                    onChange={(e) =>
                      updateNodeProperty("textColor", e.target.value)
                    }
                    className="w-7 h-7 cursor-pointer rounded border border-theme bg-transparent flex-shrink-0"
                    style={{ padding: "1px" }}
                  />
                  <input
                    type="text"
                    value={currentText}
                    placeholder="#rrggbb or rgba(…)"
                    onChange={(e) =>
                      updateNodeProperty("textColor", e.target.value)
                    }
                    className="flex-1 text-xs bg-transparent border border-theme rounded px-2 py-1 text-theme min-w-0"
                  />
                  {currentText && (
                    <button
                      type="button"
                      onClick={() => updateNodeProperty("textColor", "")}
                      className="text-muted hover:text-red-500 text-xs flex-shrink-0"
                      aria-label="Clear text color"
                      data-tooltip="Clear"
                      data-tooltip-placement="left"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      }
    } else {
      propertyElements = (
        <div className="text-sm text-muted">Node not found</div>
      );
    }
  }

  // Render custom property elements
  let customPropertyElements: React.ReactNode = null;
  if (inspectedNodeId) {
    const nodeCustomProps = customProperties[inspectedNodeId] || [];
    if (nodeCustomProps.length > 0) {
      customPropertyElements = nodeCustomProps.map((prop) => (
        <CustomPropertyInput
          key={prop.id}
          property={prop}
          onUpdate={handleUpdateCustomProperty}
          onDelete={handleDeleteCustomProperty}
        />
      ));
    } else {
      customPropertyElements = (
        <div className="text-xs text-muted text-center py-3">
          No custom properties added yet
        </div>
      );
    }
  }

  // Compute edge property elements
  let edgePropertyElements: React.ReactNode = null;
  if (inspectedEdgeId) {
    const currentEdgeColor = (edgeProps["color"] as string) || "";
    const currentStrokeWidth = (edgeProps["strokeWidth"] as number) ?? 2;
    const currentPathType = (edgeProps["pathType"] as string) || "smoothstep";
    const currentAnimated = (edgeProps["animated"] as boolean) || false;
    const currentBidirectional =
      (edgeProps["bidirectional"] as boolean) || false;
    edgePropertyElements = (
      <div className="flex flex-col gap-4">
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edge-label"
            className="text-[11px] font-semibold text-muted uppercase tracking-widest"
          >
            Label
          </label>
          <input
            id="edge-label"
            type="text"
            value={(edgeProps["label"] as string) || ""}
            placeholder="e.g. HTTP, gRPC, async…"
            onChange={(e) => {
              const newLabel = e.target.value;
              updateEdgeProperty("label", newLabel);
              updateEdgeProperty("hasLabel", newLabel.trim().length > 0);
            }}
            className="w-full text-sm bg-[var(--surface)] border border-theme rounded-lg px-3 py-2 text-theme outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]/30 transition-all placeholder:text-muted/50"
          />
        </div>

        {/* Flow purpose */}
        <div className="flex flex-col gap-1.5">
          <AnimatedTextarea
            id="edge-purpose"
            label="Flow purpose"
            value={
              ((edgeProps["purpose"] ?? edgeProps["description"]) as string) ||
              ""
            }
            placeholder={FLOW_PURPOSE_PLACEHOLDER}
            onChange={(val) => updateEdgeProperty("purpose", val)}
          />
        </div>

        {/* Path Style — visual button group */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-widest">
            Path Style
          </span>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { value: "bezier", label: "Curve", icon: "⌒" },
                { value: "straight", label: "Line", icon: "—" },
                { value: "step", label: "Step", icon: "⌐" },
                { value: "smoothstep", label: "Smooth", icon: "∫" },
              ] as const
            ).map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateEdgeProperty("pathType", value)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg border text-center transition-all cursor-pointer ${
                  currentPathType === value
                    ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                    : "border-theme bg-[var(--surface)] text-muted hover:border-[var(--brand)]/50 hover:text-theme"
                }`}
                data-tooltip={label}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="text-[9px] font-medium leading-tight">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Appearance */}
        <div className="flex flex-col gap-3 rounded-xl border border-theme/30 bg-[var(--surface)] p-3">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-widest">
            Appearance
          </span>

          {/* Color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted w-12 flex-shrink-0">
              Color
            </label>
            <div className="relative flex-shrink-0">
              <input
                type="color"
                value={currentEdgeColor || "#6366f1"}
                onChange={(e) => updateEdgeProperty("color", e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                aria-label="Pick color"
                data-tooltip="Pick color"
              />
              <div
                className="w-7 h-7 rounded-md border-2 border-white/30 shadow"
                style={{ backgroundColor: currentEdgeColor || "var(--brand)" }}
              />
            </div>
            <input
              type="text"
              value={currentEdgeColor}
              placeholder="default"
              onChange={(e) => updateEdgeProperty("color", e.target.value)}
              className="flex-1 text-xs bg-transparent border border-theme rounded-md px-2 py-1.5 text-theme outline-none focus:border-[var(--brand)] min-w-0 font-mono"
            />
            {currentEdgeColor && (
              <button
                type="button"
                onClick={() => updateEdgeProperty("color", "")}
                className="text-muted hover:text-red-400 text-sm flex-shrink-0 transition-colors"
                aria-label="Reset to default"
                data-tooltip="Reset to default"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted w-12 flex-shrink-0">
              Width
            </label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={currentStrokeWidth}
              onChange={(e) =>
                updateEdgeProperty("strokeWidth", Number(e.target.value))
              }
              className="flex-1 cursor-pointer accent-[var(--brand)]"
            />
            <div className="flex items-center justify-center w-9 h-6 rounded bg-[var(--bg-hover)] flex-shrink-0">
              <span className="text-[11px] font-mono text-theme">
                {currentStrokeWidth}px
              </span>
            </div>
          </div>

          {/* Animated toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Animated dash</span>
            <button
              type="button"
              role="switch"
              aria-checked={currentAnimated}
              onClick={() => updateEdgeProperty("animated", !currentAnimated)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${currentAnimated ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${currentAnimated ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>

          {/* Bidirectional toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted">Bidirectional</span>
              <span className="text-[10px] text-muted/60">
                Arrows on both ends
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={currentBidirectional}
              onClick={() =>
                updateEdgeProperty("bidirectional", !currentBidirectional)
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer flex-shrink-0 ${currentBidirectional ? "bg-[var(--brand)]" : "bg-[var(--border)]"}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${currentBidirectional ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => {
            setEdges((eds) => eds.filter((e) => e.id !== inspectedEdgeId));
            setInspectedEdgeId(null);
            setActiveRightTab("details");
          }}
          className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-red-500/8 text-red-500 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 transition-all text-sm font-medium cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Delete Connection
        </button>
      </div>
    );
  }

  // Handle copying a node (defined before early returns to satisfy React Hook rules)
  const handleNodeCopy = useCallback(
    (id: string, data: AnyNodeData) => {
      const originalNode = nodesRef.current.find((n) => n.id === id);
      if (!originalNode) return;

      // Create a new node with copied data but new position and ID
      const newNodeId = `${id}-copy-${Date.now()}`;
      const newNode: Node = {
        ...originalNode,
        id: newNodeId,
        position: {
          x: originalNode.position.x + 200, // Larger offset to prevent overlap
          y: originalNode.position.y + 100,
        },
        data: { ...data },
        selected: false, // Ensure the copied node is not selected
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // Register node types (memoized to prevent unnecessary re-renders)
  const nodeTypes = useMemo(
    () => ({
      custom: createNodeWithCopyHandler(handleNodeCopy, nodesRef),
      erNode: createERNodeWithCopyHandler(handleNodeCopy, nodesRef),
      freeform: createFreeformNodeWithCopyHandler(handleNodeCopy, nodesRef),
      tableNode: createTableNodeWithCopyHandler(handleNodeCopy, nodesRef),
      group: GroupNode,
    }),
    [handleNodeCopy],
  );

  // Load collaborators for current diagram
  const loadCollaborators = useCallback(async () => {
    if (!currentDiagramId || !showShareModal) return;

    try {
      setIsLoadingCollaborators(true);
      const collaboratorsData =
        await apiService.getCollaborators(currentDiagramId);
      setCollaborators(collaboratorsData);
    } catch (error) {
      console.error("Failed to load collaborators:", error);
      toastRef.current.error("Failed to load collaborators.");
    } finally {
      setIsLoadingCollaborators(false);
    }
  }, [currentDiagramId, showShareModal]);

  // Load collaborators when share modal opens
  useEffect(() => {
    if (showShareModal && currentDiagramId) {
      loadCollaborators();
    } else if (!showShareModal) {
      // Clear collaborators when modal closes
      setCollaborators([]);
    }
  }, [showShareModal, currentDiagramId, loadCollaborators]);

  // Real-time collaboration integration using unified collaboration hook
  const {
    state: collaborationState,
    collaborators: onlineCollaborators,
    cursors,
    sendCursorPosition,
  } = useUnifiedCollaboration({
    diagramId: currentDiagramId || "",
    nodes,
    edges,
    onNodesChange: useCallback(
      (updatedNodes: Node[]) => {
        // Restore icon components when receiving nodes from Yjs/collaboration
        const restoredNodes = restoreNodeIcons(updatedNodes);
        setNodes(restoredNodes);
      },
      [setNodes, restoreNodeIcons],
    ),
    onEdgesChange: useCallback(
      (updatedEdges: Edge[]) => {
        setEdges(updatedEdges);
      },
      [setEdges],
    ),
    enabled: !!currentDiagramId && isAuthenticated,
  });

  // Extract collaboration state for backward compatibility
  const isCollaborationConnected = collaborationState.isConnected;
  const isCollaborationConnecting =
    !collaborationState.isConnected && !collaborationState.error;
  const collaborationReconnectAttempts = 0; // Unified hook doesn't expose this yet

  // Sync nodes and edges changes to undo/redo history
  // Skip during collaboration to prevent conflicts

  // When full component metadata arrives (fetched lazily), update existing nodes
  // that reference that component so their icons/iconUrls become available.
  React.useEffect(() => {
    if (!fullComponentsCache || Object.keys(fullComponentsCache).length === 0)
      return;
    setNodes((nds) =>
      nds.map((n) => {
        const compId =
          typeof n.data?.componentId === "string" ? n.data.componentId : null;
        if (!compId) return n;
        const full = fullComponentsCache[compId];
        if (!full) return n;

        const hasIcon = Boolean(n.data?.icon) || Boolean(n.data?.iconUrl);
        if (hasIcon) return n;

        return {
          ...n,
          data: {
            ...n.data,
            icon: n.data?.icon ?? full.icon,
            iconUrl: n.data?.iconUrl ?? full.data?.iconUrl,
          },
        };
      }),
    );
  }, [fullComponentsCache, setNodes]);
  useEffect(() => {
    // Skip if this change is from undo/redo
    if (isApplyingUndoRedo.current) return;

    // Skip if nodes/edges are empty (initial state)
    if (nodes.length === 0 && edges.length === 0) return;

    // Skip during active collaboration to prevent undo/redo interfering with Yjs
    if (isCollaborationConnected) return;

    // Update canvas state for undo/redo tracking
    setCanvasState({ nodes, edges });
  }, [nodes, edges, setCanvasState, isCollaborationConnected]);

  // Keyboard shortcuts for undo/redo
  // Disable during collaboration to prevent conflicts with Yjs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable undo/redo during active collaboration
      if (isCollaborationConnected) return;

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        (e.ctrlKey && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, isCollaborationConnected]);

  // Note: Yjs automatically syncs nodes/edges changes, no manual sendDiagramUpdate needed
  // For custom WebSocket fallback, sendUpdate is called but it's a no-op for Yjs

  // Track cursor position for collaboration
  // Use ReactFlow's onMouseMove which provides proper coordinates
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isCollaborationConnected) return;

      // Get the ReactFlow wrapper bounds for accurate coordinate conversion
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      // Convert client coordinates relative to the ReactFlow wrapper
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      sendCursorPosition(position);
    },
    [isCollaborationConnected, sendCursorPosition, screenToFlowPosition],
  );

  // Calculate canvas context for chat bot (only for free mode)
  const canvasContext: CanvasContext | undefined = useMemo(() => {
    if (idFromUrl !== "free") return undefined;

    const componentTypes = nodes
      .map((n) => (n.data as AnyNodeData)?.componentId)
      .filter(Boolean) as string[];

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      componentTypes,
      isEmpty: nodes.length === 0,
    };
  }, [idFromUrl, nodes, edges]);

  // Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-theme mb-4">
            {isSharedView ? "Loading design\u2026" : "Loading problem..."}
          </h2>
          <div className="text-muted">
            Please wait while we fetch the problem details
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-theme mb-4">
            Error Loading Problem
          </h2>
          <div className="text-muted mb-4">{error}</div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onBack}
              className="px-4 py-2 bg-accent text-[var(--bg)] rounded-md hover:brightness-90"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => globalThis.location.reload()}
              className="px-4 py-2 bg-surface border border-theme text-theme rounded-md hover:bg-[var(--bg-hover)]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle case where no problem is found
  if (!problem) {
    return (
      <div className="min-h-screen bg-theme flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-theme mb-4">
            Problem not found
          </h2>
          <div className="text-muted mb-4">
            The requested problem could not be found.
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-accent text-[var(--bg)] rounded-md hover:brightness-90"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /**
   * Intelligently finds the best matching component from COMPONENTS array.
   * Uses multiple matching strategies for better accuracy.
   */
  function findBestMatchingComponent(
    componentIdOrLabel: string,
  ): CanvasComponent | null {
    // Strategy 1: Exact ID match (highest priority)
    const exactMatch = COMPONENTS.find((c) => c.id === componentIdOrLabel);
    if (exactMatch) return exactMatch;

    // Strategy 2: Case-insensitive ID match
    const lowerInput = componentIdOrLabel.toLowerCase();
    const caseInsensitiveMatch = COMPONENTS.find(
      (c) => c.id.toLowerCase() === lowerInput,
    );
    if (caseInsensitiveMatch) return caseInsensitiveMatch;

    // Strategy 3: Label match (case-insensitive)
    const labelMatch = COMPONENTS.find(
      (c) => c.label.toLowerCase() === lowerInput,
    );
    if (labelMatch) return labelMatch;

    // Strategy 4: Tag match (for keywords like "cache", "database", "queue")
    const tagMatch = COMPONENTS.find((c) =>
      c.tags?.some((tag) => tag.toLowerCase().includes(lowerInput)),
    );
    if (tagMatch) return tagMatch;

    // Strategy 5: Partial label match (e.g., "load balancer" matches "Load Balancer")
    const partialMatch = COMPONENTS.find(
      (c) =>
        c.label.toLowerCase().includes(lowerInput) ||
        lowerInput.includes(c.label.toLowerCase()),
    );
    if (partialMatch) return partialMatch;

    // No match found
    return null;
  }

  function findMinimalPaletteComponent(componentId: string) {
    for (const providerComps of Object.values(minimalComponentsByProvider)) {
      const match = providerComps.find(
        (component) => component.id === componentId,
      );
      if (match) return match;
    }
    return minimalComponents.find((component) => component.id === componentId);
  }

  function addNodeFromPalette(id: string) {
    // Intelligently find the best matching component
    const comp = findBestMatchingComponent(id);

    // For cloud provider components (aws, azure, gcp) not in local COMPONENTS,
    // look up the minimalComponent which has the real DB id and iconUrl.
    const minimalComp = comp ? undefined : findMinimalPaletteComponent(id);

    // Place newly added node in the center of the visible viewport
    const bounds = reactFlowWrapper.current?.getBoundingClientRect();
    if (!bounds) return;

    // Convert the center of the viewport to flow coordinates
    const position = screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });

    // Use DB component id when available so sprite lookup works
    const realId = comp?.id ?? minimalComp?.id ?? id;
    const nodeId = `${realId}-${Date.now()}`;

    // Check if it's a group/cluster component
    const isGroupComponent =
      comp?.group === "Grouping" ||
      (minimalComp as MinimalComponent | undefined)?.nodeType === "group";

    // Determine node type
    const nodeTypeToUse =
      comp?.nodeType ??
      minimalComp?.nodeType ??
      (isGroupComponent ? "group" : "custom");

    const finalLabel = comp?.label ?? minimalComp?.label ?? id;
    const finalIcon = comp?.icon;
    const finalSubtitle = comp?.description ?? minimalComp?.description ?? "";
    const finalIconUrl = minimalComp?.iconUrl ?? comp?.iconUrl;

    // Provide sensible defaults for freeform nodes (persisted style + data.shape)
    // Prefer width/height from the palette/component metadata when present. Also
    // include any property defaults (from local or fetched full component).
    const isFreeformNode = (nodeTypeToUse as string) === "freeform";
    const defaultW2 = Number(comp?.width ?? minimalComp?.width ?? 180);
    const defaultH2 = Number(comp?.height ?? minimalComp?.height ?? 120);
    const fullCompForDefaults = fullComponentsCache[realId];
    const propList2 = comp?.properties ?? fullCompForDefaults?.properties ?? [];
    const propDefaults2 = (propList2 || []).reduce(
      (acc: Record<string, unknown>, p: ComponentProperty) => {
        if (p.default !== undefined) acc[p.key] = p.default;
        return acc;
      },
      {} as Record<string, unknown>,
    );
    const shapeTypeFromProps2 =
      (propDefaults2.shapeType as string | undefined) ?? undefined;
    const freeformDefault = isFreeformNode
      ? {
          style: { width: defaultW2, height: defaultH2 },
          data: {
            shape: {
              type: shapeTypeFromProps2 ?? "rect",
              width: defaultW2,
              height: defaultH2,
            },
            ...propDefaults2,
          },
        }
      : {};
    let nodeStyle: Node["style"];
    if (isGroupComponent) {
      nodeStyle = {
        width: 400,
        height: 300,
        zIndex: -1,
      };
    } else if (isFreeformNode) {
      nodeStyle = freeformDefault.style as Node["style"];
    }

    const newNode: Node = {
      id: nodeId,
      position,
      type: nodeTypeToUse as unknown as Node["type"],
      style: nodeStyle,
      data: {
        label: finalLabel,
        componentId: realId, // real DB id — used for sprite lookup
        icon: finalIcon,
        iconUrl: finalIconUrl, // fallback until sprite loads
        subtitle: finalSubtitle,
        backgroundColor: isGroupComponent
          ? "rgba(100, 100, 255, 0.05)"
          : undefined,
        borderColor: isGroupComponent ? "rgba(100, 100, 255, 0.3)" : undefined,
        ...(isFreeformNode
          ? (freeformDefault.data as unknown as AnyNodeData)
          : {}),
      },
    };

    setNodes((nds) => [...nds, newNode]);
    if (!firstComponentTrackedRef.current) {
      firstComponentTrackedRef.current = true;
      trackEvent("first_component_added", {
        problem_id: idFromUrl === "free" ? undefined : idFromUrl,
        component_type: realId,
      });
    }
  }

  // Clear all nodes and edges from canvas
  const handleClearCanvas = () => {
    if (nodes.length === 0 && edges.length === 0) {
      return; // Nothing to clear
    }
    setShowClearConfirm(true);
  };

  const confirmClearCanvas = async () => {
    // Clear local canvas state immediately for instant UX
    setNodes([]);
    setEdges([]);
    setInspectedNodeId(null);
    setAssessment(null);
    setShowClearConfirm(false);

    // If user opted to also clear saved progress, remove local or server-side saves
    if (!clearSavedOnConfirm) {
      return setClearSavedOnConfirm(false);
    }

    try {
      // Custom problems stored in localStorage (custom-...)
      if (
        idFromUrl &&
        idFromUrl.startsWith &&
        idFromUrl.startsWith("custom-")
      ) {
        localStorage.removeItem(`custom-problem-${idFromUrl}`);
      } else if (diagramIdFromUrl && currentDiagramId) {
        // Viewing a diagram by URL: delete user's diagram if authenticated
        if (isAuthenticated && currentDiagramId) {
          await apiService.deleteDiagram(currentDiagramId);
          setCurrentDiagramId(null);
          setCurrentDiagram(null);
        } else {
          toast.error("Cannot delete public diagram while not authenticated");
        }
      } else if (idFromUrl === "free") {
        // Free mode: clear last-diagram key from localStorage
        const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
        localStorage.removeItem(lastDiagramKey);
        // Starting a fresh blank canvas — let the intent/save prompts show again
        localStorage.removeItem(PROJECT_INTENT_DISMISSED_KEY);
        localStorage.removeItem(SAVE_DIALOG_DISMISSED_KEY);
        userDeclinedSaveRef.current = false;
      } else if (idFromUrl && idFromUrl !== "free") {
        // Problem attempt: delete saved attempt on server (requires auth)
        if (isAuthenticated) {
          await apiService.deleteAttempt(idFromUrl);
          setSavedAttemptId(null);
          setIsAttemptPublic(false);
        } else {
          toast.error("Cannot delete attempt while not authenticated");
        }
      }

      toast.success("Saved progress cleared");
    } catch (err) {
      console.error("Failed to clear saved progress", err);
      toast.error("Failed to clear saved progress");
    } finally {
      setClearSavedOnConfirm(false);
    }
  };

  const cancelClearCanvas = () => {
    setShowClearConfirm(false);
  };

  // Download canvas as image
  /**
   * Capture the current canvas viewport as a PNG data URL.
   * Shared between downloadImage() and ShareToWorldModal screenshot.
   */
  const captureCanvasPng = async (): Promise<string> => {
    const nodesBounds = getNodesBounds(getNodes());
    const padding = 80;
    const sourceWidth = Math.max(nodesBounds.width + padding * 2, 320);
    const sourceHeight = Math.max(nodesBounds.height + padding * 2, 200);
    const maxPreviewWidth = 1280;
    const maxPreviewHeight = 800;
    const previewScale = Math.min(
      1,
      maxPreviewWidth / sourceWidth,
      maxPreviewHeight / sourceHeight,
    );
    const imageWidth = Math.round(sourceWidth * previewScale);
    const imageHeight = Math.round(sourceHeight * previewScale);

    const viewportElement = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;

    if (!viewportElement) throw new Error("Viewport element not found");

    const docStyle = getComputedStyle(document.documentElement);
    const bgColor =
      docStyle.getPropertyValue("--bg").trim() ||
      docStyle.getPropertyValue("--surface").trim() ||
      "#ffffff";

    return toPng(viewportElement, {
      backgroundColor: bgColor,
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 1,
      skipFonts: true,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transformOrigin: "top left",
        transform: `translate(${(-nodesBounds.x + padding) * previewScale}px, ${(-nodesBounds.y + padding) * previewScale}px) scale(${previewScale})`,
      },
    });
  };

  const downloadImage = (
    format: "png" | "jpeg" | "svg" = "png",
    useTransparentBg = false,
  ) => {
    const nodesBounds = getNodesBounds(getNodes());

    // Add padding to prevent cropping (100px on each side)
    const padding = 100;
    const imageWidth = nodesBounds.width + padding * 2;
    const imageHeight = nodesBounds.height + padding * 2;

    const viewportElement = document.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement;

    if (!viewportElement) {
      console.error("Viewport element not found");
      return;
    }

    let downloadFunc;
    let fileExtension;

    if (format === "svg") {
      downloadFunc = toSvg;
      fileExtension = "svg";
    } else if (format === "jpeg") {
      downloadFunc = toJpeg;
      fileExtension = "jpg";
    } else {
      downloadFunc = toPng;
      fileExtension = "png";
    }

    // JPEG always needs a solid color; PNG/SVG can use the export preference.
    const getExportBgColor = () => {
      if (format === "jpeg") return "#ffffff";
      if (useTransparentBg) return "transparent";
      // Use the computed theme background color
      const docStyle = getComputedStyle(document.documentElement);
      return (
        docStyle.getPropertyValue("--bg").trim() ||
        docStyle.getPropertyValue("--surface").trim() ||
        "#ffffff"
      );
    };

    downloadFunc(viewportElement, {
      backgroundColor: getExportBgColor(),
      width: imageWidth,
      height: imageHeight,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`,
      },
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.setAttribute(
          "download",
          `system-design-${Date.now()}.${fileExtension}`,
        );
        a.setAttribute("href", dataUrl);
        a.click();
      })
      .catch((error) => {
        console.error("Error generating image:", error);
      });
  };

  // Export diagram as JSON
  const handleExportJSON = () => {
    try {
      const title = problem?.title || "System Design";
      const description = problem?.description;
      const jsonContent = exportAsJSON(nodes, edges, title, description);
      const filename = `${title.replaceAll(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`;
      downloadFile(jsonContent, filename, "application/json");
      toastRef.current.success("Design exported as JSON successfully!");
    } catch (error) {
      console.error("Export JSON error:", error);
      toastRef.current.error("Failed to export as JSON");
    }
  };

  // Export diagram as XML
  const handleExportXML = () => {
    try {
      const title = problem?.title || "System Design";
      const description = problem?.description;
      const xmlContent = exportAsXML(nodes, edges, title, description);
      const filename = `${title.replaceAll(/\s+/g, "-").toLowerCase()}-${Date.now()}.xml`;
      downloadFile(xmlContent, filename, "application/xml");
      toast.success("Design exported as XML successfully!");
    } catch (error) {
      console.error("Export XML error:", error);
      toast.error("Failed to export as XML");
    }
  };

  // Import diagram from file
  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      let importedData: { nodes: Node[]; edges: Edge[] };

      // Determine file type and parse accordingly
      if (file.name.endsWith(".json")) {
        importedData = importFromJSON(content);
        toast.success("Design imported from JSON successfully!");
      } else if (file.name.endsWith(".xml")) {
        importedData = importFromXML(content);
        toast.success("Design imported from XML successfully!");
      } else {
        // Try to detect format from content
        const trimmed = content.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          importedData = importFromJSON(content);
          toast.success("Design imported from JSON successfully!");
        } else if (
          trimmed.startsWith("<?xml") ||
          trimmed.startsWith("<mxfile")
        ) {
          importedData = importFromXML(content);
          toast.success("Design imported from XML successfully!");
        } else {
          throw new Error(
            "Unsupported file format. Please use JSON or XML files.",
          );
        }
      }

      // Restore icon components and ensure we have full component data
      const restoredNodes = restoreNodeIcons(importedData.nodes);

      // Apply imported data
      setNodes(restoredNodes);
      setEdges(restoreEdgePurposes(importedData.edges));

      // Clear current diagram ID since this is now a new/imported diagram
      setCurrentDiagramId(null);
      setShowExtensionHub(false);

      // Fit view to show all imported nodes
      setTimeout(() => {
        fitView({
          ...getAdaptiveFitViewOptions(restoredNodes, importedData.edges),
          duration: 400,
        });
      }, 100);
    } catch (error) {
      console.error("Import error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import diagram",
      );
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Trigger file input click
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleExtensionImport = (
    result: ExtensionImportResult,
    sourceName: string,
  ) => {
    const restoredNodes = restoreNodeIcons(result.nodes);
    setCurrentDiagramId(null);
    setShowExtensionHub(false);
    setExtensionImportStatus("Preparing imported schema…");

    // Let the progress overlay paint before starting the async graph layout.
    window.setTimeout(() => {
      setExtensionImportStatus(
        `Arranging ${restoredNodes.length} elements and ${result.edges.length} relationships…`,
      );

      void layoutAndFitCanvas(
        restoredNodes,
        result.edges,
        getLayoutDirectionForMenu(restoredNodes, "horizontal"),
        (callback) => window.setTimeout(callback, 100),
      )
        .then(() => {
          setEdges(result.edges);
          toast.success(`${sourceName} imported: ${result.summary}.`);
          if (result.warnings.length > 0) {
            toast.info(
              `${result.warnings.length} import note${result.warnings.length === 1 ? "" : "s"} should be reviewed on the canvas.`,
            );
          }
        })
        .catch((error) => {
          console.error("Failed to lay out imported diagram:", error);
          toast.error(
            `${sourceName} was imported, but automatic layout failed.`,
          );
        })
        .finally(() => {
          setExtensionImportStatus(null);
        });
    }, 0);
  };

  // Handle sharing diagram with collaborator
  const handleShareDiagram = async () => {
    if (!shareEmail.trim() || !currentDiagramId) return;

    try {
      setIsSharing(true);
      await apiService.addCollaborator(
        currentDiagramId,
        shareEmail.trim(),
        sharePermission,
      );
      toastRef.current.success(
        `Diagram shared with ${shareEmail} successfully!`,
      );
      setShareEmail("");
      setSharePermission("read");
      // Reload collaborators
      loadCollaborators();
    } catch (error) {
      console.error("Failed to Share Design:", error);
      toastRef.current.error("Failed to Share Design. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  // Update collaborator permission
  const handleUpdateCollaboratorPermission = async (
    collaboratorId: string,
    permission: "read" | "edit",
  ) => {
    if (!currentDiagramId) return;

    try {
      await apiService.updateCollaborator(
        currentDiagramId,
        collaboratorId,
        permission,
      );
      toastRef.current.success("Permission updated successfully!");
      // Reload collaborators
      loadCollaborators();
    } catch (error) {
      console.error("Failed to update permission:", error);
      toastRef.current.error("Failed to update permission.");
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!currentDiagramId) return;

    try {
      await apiService.removeCollaborator(currentDiagramId, collaboratorId);
      toastRef.current.success("Collaborator removed successfully!");
      // Reload collaborators
      loadCollaborators();
    } catch (error) {
      console.error("Failed to remove collaborator:", error);
      toastRef.current.error("Failed to remove collaborator.");
    }
  };

  // Handle project intent dialog
  const handleProjectIntentSubmit = (intent: UserIntent) => {
    setUserIntent(intent);
    setShowProjectIntentDialog(false);
    localStorage.setItem(PROJECT_INTENT_DISMISSED_KEY, "true");
    toast.success("Great! I'll provide suggestions based on your project.");
  };

  const handleProjectIntentSkip = () => {
    setShowProjectIntentDialog(false);
    localStorage.setItem(PROJECT_INTENT_DISMISSED_KEY, "true");
  };

  // Handle title dialog confirmation
  const handleTitleDialogConfirm = async (intent: UserIntent) => {
    if (!intent.title.trim()) return;

    try {
      setAutoSaveStatus("saving");

      const diagramData = {
        title: intent.title.trim(),
        description: intent.description.trim() || undefined,
        nodes,
        edges,
        reasoningContext,
      };

      const savedDiagram = await apiService.saveDiagram(diagramData);
      setCurrentDiagramId(savedDiagram.id);
      setCurrentDiagram(savedDiagram);

      // Store the diagram ID for restoration on refresh
      const lastDiagramKey = `last-diagram-${user?.id || "anonymous"}`;
      localStorage.setItem(lastDiagramKey, savedDiagram.id);

      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
      setShowTitleDialog(false);

      toast.success("Design saved successfully!");
    } catch (error) {
      console.error("Failed to save diagram:", error);
      setAutoSaveStatus("error");
      toast.error("Failed to save design. Please try again.");
    }
  };

  const handleTitleDialogCancel = () => {
    userDeclinedSaveRef.current = true; // Stop auto-prompting; user can click Save when ready
    localStorage.setItem(SAVE_DIALOG_DISMISSED_KEY, "true");
    setShowTitleDialog(false);
    setAutoSaveStatus("idle");
  };

  // Explicitly triggered save — resets the declined flag and opens the dialog
  const handleManualSave = () => {
    userDeclinedSaveRef.current = false;
    localStorage.removeItem(SAVE_DIALOG_DISMISSED_KEY);
    setShowTitleDialog(true);
  };

  // Calculate a Dagre layout while keeping group positioning intact.
  const getLayoutedNodes = (
    nodesToLayout: Node[],
    edgesToLayout: Edge[],
    direction: "TB" | "LR" = "TB",
  ): Node[] => {
    // Separate groups and regular nodes
    const groupNodes = nodesToLayout.filter((node) => node.type === "group");
    const regularNodes = nodesToLayout.filter(
      (node) => node.type !== "group" && !node.parentId,
    );

    // Function to get node dimensions based on type
    const getNodeDimensions = (node: Node) => {
      // ER diagram nodes (tableNode, erNode) are larger
      if (node.type === "tableNode") {
        // Table nodes vary based on number of attributes, use max size
        return { width: 400, height: 400 };
      } else if (node.type === "erNode") {
        // ER nodes (View, Trigger, Note) have max dimensions
        return { width: 400, height: 300 };
      }
      // Default system design nodes
      return { width: 200, height: 80 };
    };

    // Store dimensions for later use
    const nodeDimensions = new Map<string, { width: number; height: number }>();

    // Layout children within each group (keep groups in their current positions)
    const childLayouts = new Map<
      string,
      Map<string, { x: number; y: number }>
    >();

    const layoutGroupChildren = (children: Node[]) => {
      const childGraph = new dagre.graphlib.Graph();
      childGraph.setDefaultEdgeLabel(() => ({}));
      childGraph.setGraph({
        rankdir: direction,
        nodesep: direction === "LR" ? 80 : 60,
        ranksep: direction === "LR" ? 100 : 80,
        marginx: 20,
        marginy: 20,
      });

      // Add children to the graph
      for (const child of children) {
        const dims = getNodeDimensions(child);
        nodeDimensions.set(child.id, dims);
        childGraph.setNode(child.id, dims);
      }

      // Add edges between children
      const childEdges = edgesToLayout.filter(
        (edge) =>
          children.some((c) => c.id === edge.source) &&
          children.some((c) => c.id === edge.target),
      );
      for (const edge of childEdges) {
        childGraph.setEdge(edge.source, edge.target);
      }

      // Layout children
      dagre.layout(childGraph);

      // Calculate offset to center children within the group
      // Add padding from group edges
      const paddingX = 30;
      const paddingY = 50; // More padding at top for group header

      // Store child positions (relative to parent group)
      const positions = new Map<string, { x: number; y: number }>();
      for (const child of children) {
        const nodeWithPosition = childGraph.node(child.id);
        if (nodeWithPosition) {
          const dims = nodeDimensions.get(child.id) || {
            width: 200,
            height: 80,
          };
          // Position relative to parent, with padding
          positions.set(child.id, {
            x: nodeWithPosition.x - dims.width / 2 + paddingX,
            y: nodeWithPosition.y - dims.height / 2 + paddingY,
          });
        }
      }

      return positions;
    };

    for (const groupNode of groupNodes) {
      const children = nodesToLayout.filter((n) => n.parentId === groupNode.id);
      if (children.length === 0) continue;

      const positions = layoutGroupChildren(children);

      childLayouts.set(groupNode.id, positions);
    }

    // Only layout regular nodes (non-grouped nodes without parents)
    const regularGraph = new dagre.graphlib.Graph();
    regularGraph.setDefaultEdgeLabel(() => ({}));
    regularGraph.setGraph({
      rankdir: direction,
      nodesep: direction === "LR" ? 150 : 80, // More horizontal space for LR layout
      ranksep: direction === "LR" ? 200 : 100, // More vertical space for LR layout
    });

    for (const node of regularNodes) {
      const dims = getNodeDimensions(node);
      nodeDimensions.set(node.id, dims);
      regularGraph.setNode(node.id, dims);
    }

    // Add edges between regular nodes
    const regularEdges = edgesToLayout.filter(
      (edge) =>
        regularNodes.some((n) => n.id === edge.source) &&
        regularNodes.some((n) => n.id === edge.target),
    );
    for (const edge of regularEdges) {
      regularGraph.setEdge(edge.source, edge.target);
    }
    if (regularNodes.length > 0) {
      dagre.layout(regularGraph);
    }

    // Apply positions
    return nodesToLayout.map((node) => {
      if (node.type === "group") {
        // Keep group nodes in their current positions - DO NOT MOVE
        return node;
      } else if (node.parentId) {
        // Layout child nodes within their parent group
        const childLayout = childLayouts.get(node.parentId);
        if (childLayout) {
          const position = childLayout.get(node.id);
          if (position) {
            return {
              ...node,
              position: {
                x: position.x,
                y: position.y,
              },
            };
          }
        }
        // Fallback: keep existing position if layout failed
        return node;
      } else {
        // Position regular nodes
        const nodeWithPosition = regularGraph.node(node.id);
        if (nodeWithPosition) {
          const dims = nodeDimensions.get(node.id) || {
            width: 200,
            height: 80,
          };
          return {
            ...node,
            position: {
              x: nodeWithPosition.x - dims.width / 2,
              y: nodeWithPosition.y - dims.height / 2,
            },
          };
        }
      }
      return node;
    });
  };

  const layoutCanvasNodes = async (
    nodesToLayout: Node[],
    edgesToLayout: Edge[],
    direction: "TB" | "LR",
  ): Promise<Node[]> => {
    if (!canUseERDLayout(nodesToLayout)) {
      return getLayoutedNodes(nodesToLayout, edgesToLayout, direction);
    }

    try {
      return await getERDLayoutedNodes(nodesToLayout, edgesToLayout, direction);
    } catch (error) {
      console.error("ELK ERD layout failed; falling back to Dagre:", error);
      return getLayoutedNodes(nodesToLayout, edgesToLayout, direction);
    }
  };

  const layoutAndFitCanvas = async (
    nodesToLayout: Node[],
    edgesToLayout: Edge[],
    direction: "TB" | "LR",
    scheduleFit: (callback: () => void) => void = (callback) =>
      globalThis.requestAnimationFrame(callback),
  ): Promise<Node[]> => {
    const layoutedNodes = await layoutCanvasNodes(
      nodesToLayout,
      edgesToLayout,
      direction,
    );
    setNodes(layoutedNodes);
    scheduleFit(() => {
      fitView({
        ...getAdaptiveFitViewOptions(layoutedNodes, edgesToLayout, direction),
        duration: 400,
      });
    });
    return layoutedNodes;
  };

  // Auto-layout the existing canvas with the appropriate graph layout engine.
  const onLayout = (direction: "TB" | "LR" = "TB") => {
    void layoutAndFitCanvas(nodes, edges, direction).catch((error) => {
      console.error("Failed to auto-layout diagram:", error);
      toast.error("Automatic layout failed. Your current layout was kept.");
    });
  };

  // Persist nodeProps back into node data.
  const handleSave = () => {
    // Filter out numeric keys and _customProperties since they're managed separately
    const filteredNodeProps = Object.fromEntries(
      Object.entries(nodeProps).filter(([key]) => {
        // Keep non-numeric keys and exclude _customProperties
        return Number.isNaN(Number(key)) && key !== "_customProperties";
      }),
    );

    setNodes((nds) =>
      nds.map((n) =>
        n.id === inspectedNodeId
          ? { ...n, data: { ...n.data, ...filteredNodeProps } }
          : n,
      ),
    );
  };

  const pageTitle =
    idFromUrl === "free"
      ? "Design Studio | Diagramwise"
      : `${problem?.title || "System Design Challenge"} | Diagramwise`;

  const pageDescription =
    idFromUrl === "free"
      ? "Create system architecture diagrams from scratch with our free interactive canvas. Design, prototype, and visualize your ideas with architecture components."
      : `Solve the ${problem?.title || "system design"} challenge. ${problem?.description?.substring(0, 150) || "Practice system design skills"}...`;
  const publicDesignIsLive = savedAttemptId
    ? isAttemptPublic
    : Boolean(currentDiagram?.isPublic);
  const publicDesignAction = publicDesignIsLive
    ? "Manage public link"
    : "Publish design";
  const publicDesignStatus = publicDesignIsLive ? "Public" : "Publish";
  const publicDesignButtonClass = publicDesignIsLive
    ? "bg-emerald-500 text-white hover:bg-emerald-400"
    : "bg-white/15 text-white hover:bg-white/25";

  return (
    <>
      <SEO
        title={pageTitle}
        description={pageDescription}
        keywords={`system design playground, ${problem?.title || "free canvas"}, architecture diagram tool, ${problem?.category || "design tool"}`}
        image="https://diagramwise.com/og/playground.png"
        imageAlt={
          problem?.title
            ? `${problem.title} playground preview`
            : "Diagramwise design playground preview"
        }
        url={`https://diagramwise.com/playground/${idFromUrl || "free"}`}
        noIndex
      />
      <div className="design-studio-page h-screen flex flex-col overflow-hidden bg-theme">
        {/* Header */}
        <header className="bg-[var(--brand)] shadow-md overflow-visible">
          <div className="max-w-full mx-auto px-4 sm:px-6 overflow-visible">
            <div className="flex items-center justify-between h-14 overflow-visible">
              {/* Left side - Logo and Title */}
              <div className="flex items-center space-x-4">
                <Link
                  className="systema-brand"
                  to="/"
                  aria-label="Diagramwise home"
                >
                  <img src="/logo-64.png" alt="" aria-hidden="true" />
                  <span>Diagramwise</span>
                </Link>
                <div className="hidden md:flex items-center space-x-3 border-l border-white/20 ml-3 pl-4">
                  <h1
                    className="text-sm font-semibold text-white max-w-[200px] truncate cursor-default"
                    data-tooltip={problem.title}
                  >
                    {problem.title}
                  </h1>

                  {/* Show difficulty and estimated time only for problems, not Design Studio or shared view */}
                  {idFromUrl !== "free" && !isSharedView && (
                    <>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          problem.difficulty === "Easy"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : problem.difficulty === "Medium"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {problem.difficulty}
                      </span>
                      {problem.estimated_time && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 flex items-center gap-1">
                          <MdAccessTime className="h-3 w-3" />
                          {problem.estimated_time}
                        </span>
                      )}
                    </>
                  )}

                  {/* Timer - only show for problems, not Design Studio or shared view */}
                  {idFromUrl !== "free" && !isSharedView && (
                    <div
                      className="flex items-center gap-1 border-l border-white/20 pl-3"
                      data-tour="timer"
                    >
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 flex items-center gap-1 font-mono">
                        {formatTime(elapsedTime)}
                      </span>
                    </div>
                  )}

                  {/* Read-only badge for shared view */}
                  {isSharedView && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-white/10 text-white/80">
                      View only
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Design Management Buttons (only for free mode and authenticated users) */}
                {idFromUrl === "free" && (
                  <div className="hidden sm:flex items-center gap-2 border-white/20">
                    {/* Manual Save button — shown when authenticated with unsaved canvas */}
                    {isAuthenticated &&
                      !currentDiagramId &&
                      nodes.length > 0 && (
                        <button
                          type="button"
                          onClick={handleManualSave}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-white/20 hover:bg-white/30 rounded-md transition-colors cursor-pointer"
                          data-tooltip="Save Design"
                          data-tour="save-btn"
                        >
                          <MdSave className="h-4 w-4" />
                          Save
                        </button>
                      )}
                    {/* Auto-save indicator */}
                    {autoSaveEnabled && (
                      <div className="flex items-center gap-2 px-2 py-1 text-xs text-white/80">
                        {autoSaveStatus === "saving" && (
                          <>
                            <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving...</span>
                          </>
                        )}
                        {autoSaveStatus === "saved" && (
                          <>
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                            <span>
                              Saved{" "}
                              {lastSavedAt && formatSavedTime(lastSavedAt)}
                            </span>
                          </>
                        )}
                        {autoSaveStatus === "error" && (
                          <>
                            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                            <span>Save failed</span>
                          </>
                        )}
                        {autoSaveStatus === "idle" && lastSavedAt && (
                          <>
                            <div className="w-3 h-3 bg-white/40 rounded-full"></div>
                            <span>Saved {formatSavedTime(lastSavedAt)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Auto-save indicator for problem-solving mode */}
                {idFromUrl && idFromUrl !== "free" && autoSaveEnabled && (
                  <div className="hidden sm:flex items-center gap-2 border-white/20">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs text-white/80">
                      {autoSaveStatus === "saving" && (
                        <>
                          <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving progress...</span>
                        </>
                      )}
                      {autoSaveStatus === "saved" && (
                        <>
                          <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                          <span>
                            Progress saved{" "}
                            {lastSavedAt && formatSavedTime(lastSavedAt)}
                          </span>
                        </>
                      )}
                      {autoSaveStatus === "error" && (
                        <>
                          <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                          <span>Save failed</span>
                        </>
                      )}
                      {autoSaveStatus === "idle" && lastSavedAt && (
                        <>
                          <div className="w-3 h-3 bg-white/40 rounded-full"></div>
                          <span>
                            Progress saved {formatSavedTime(lastSavedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Undo/Redo buttons */}
                <div className="hidden sm:flex items-center gap-1 border-l border-r border-white/20 pl-2 pr-2">
                  <button
                    type="button"
                    onClick={undo}
                    disabled={!canUndo || extensionImportStatus !== null}
                    className="p-2 text-white hover:bg-white/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    data-tooltip="Undo (Ctrl+Z)"
                  >
                    <MdUndo className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={redo}
                    disabled={!canRedo || extensionImportStatus !== null}
                    className="p-2 text-white hover:bg-white/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    data-tooltip="Redo (Ctrl+Y or Ctrl+Shift+Z)"
                  >
                    <MdRedo className="h-5 w-5" />
                  </button>

                  {/* Clear Canvas button */}
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    disabled={
                      (nodes.length === 0 && edges.length === 0) ||
                      extensionImportStatus !== null
                    }
                    className="p-2 text-white hover:bg-white/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    data-tooltip="Clear Canvas"
                  >
                    <MdClose className="h-5 w-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExtensionHub(true)}
                  disabled={extensionImportStatus !== null}
                  className="p-2 text-white hover:bg-white/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  data-tooltip="Extensions: import and export"
                  data-tour="export-btn"
                  aria-label="Open extensions"
                >
                  <MdExtension className="h-5 w-5" />
                </button>

                {/* Layout button with dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                    disabled={
                      nodes.length === 0 || extensionImportStatus !== null
                    }
                    className="p-2 text-white hover:bg-white/20 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    data-tooltip="Auto Layout"
                  >
                    <FcFlowChart className="h-5 w-5" />
                  </button>

                  {/* Layout direction dropdown */}
                  {showLayoutMenu && (
                    <div className="absolute top-full right-0 mt-1 bg-[var(--surface)] shadow-lg rounded-lg border border-theme/10 py-1 z-50 min-w-[160px]">
                      <button
                        type="button"
                        onClick={() => {
                          onLayout(
                            getLayoutDirectionForMenu(nodes, "horizontal"),
                          );
                          setShowLayoutMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-theme hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      >
                        Horizontal Layout
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onLayout(
                            getLayoutDirectionForMenu(nodes, "vertical"),
                          );
                          setShowLayoutMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-theme hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      >
                        Vertical Layout
                      </button>
                    </div>
                  )}
                </div>

                {/* Share button - only show for Design Studio and authenticated users with owned diagrams */}
                {idFromUrl === "free" &&
                  isAuthenticated &&
                  currentDiagramId &&
                  currentDiagram?.isOwner !== false && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowShareModal(true)}
                        className="p-2 text-white hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                        data-tooltip="Invite collaborators"
                        aria-label="Invite collaborators"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                          />
                        </svg>
                      </button>

                      {/* Collaboration Status - Figma-style: invisible when working, visible when needed */}
                      <CollaborationStatus
                        isConnected={isCollaborationConnected}
                        isConnecting={isCollaborationConnecting}
                        reconnectAttempts={collaborationReconnectAttempts}
                        collaborators={onlineCollaborators}
                        showCollaborators={true}
                      />
                    </>
                  )}

                {!isSharedView &&
                  isAuthenticated &&
                  ((idFromUrl === "free" &&
                    currentDiagramId &&
                    currentDiagram?.isOwner !== false) ||
                    (idFromUrl !== "free" && savedAttemptId)) && (
                    <button
                      type="button"
                      onClick={() => setShowShareToWorldModal(true)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${publicDesignButtonClass}`}
                      aria-label={publicDesignAction}
                      data-tooltip={publicDesignAction}
                    >
                      <MdPublic className="h-4 w-4" aria-hidden />
                      <span className="hidden lg:inline">
                        {publicDesignStatus}
                      </span>
                    </button>
                  )}

                {problem?.id !== "free" && (
                  <div
                    data-tour="assess-btn"
                    data-tooltip={getAssessmentTooltip(
                      isAuthenticated,
                      isAssessing,
                      isPreparingInterview,
                    )}
                  >
                    <button
                      type="button"
                      onClick={runAssessment}
                      disabled={
                        isAssessing || isPreparingInterview || !isAuthenticated
                      }
                      className="px-6 py-1 text-white font-bold rounded-md hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      {getAssessmentActionLabel(
                        isAssessing,
                        isPreparingInterview,
                      )}
                    </button>
                  </div>
                )}
                {/* Tour trigger */}
                {!isSharedView && (
                  <button
                    type="button"
                    onClick={startTour}
                    className="flex items-center gap-1 px-2 py-1.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    data-tooltip="Take a tour"
                  >
                    <MdHelpOutline className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Tour</span>
                  </button>
                )}
                <ThemeSwitcher />
                {/* User Profile / Auth Button */}
                <div className="relative">
                  {isAuthenticated ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 rounded-md transition-colors"
                      >
                        {user?.picture ? (
                          <img
                            src={user.picture}
                            alt={user.name || "User"}
                            className="w-8 h-8 rounded-full object-cover border-2 border-white"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold">
                            {user?.name?.[0]?.toUpperCase() ||
                              user?.email?.[0]?.toUpperCase() ||
                              "U"}
                          </div>
                        )}
                        <span className="hidden sm:inline">
                          {user?.name || user?.email}
                        </span>
                        <MdExpandMore className="h-4 w-4" />
                      </button>

                      {showUserMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-[var(--surface)] shadow-lg rounded-lg border border-theme/10 py-1 z-50 min-w-[180px]">
                          <div className="px-4 py-2">
                            <p className="text-sm font-medium text-theme">
                              {user?.name || "User"}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {user?.email}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              // Open preferences editor (Quick Setup modal)
                              globalThis.dispatchEvent(
                                new Event("open-quick-setup"),
                              );
                              setShowUserMenu(false);
                            }}
                            aria-label="Edit preferences"
                            className="w-full px-4 py-2 text-left text-sm text-theme hover:bg-[var(--bg-hover,var(--bg))] dark:hover:bg-[var(--bg-hover,var(--bg))] transition-colors border-b border-theme/10"
                          >
                            Edit preferences
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              logout();
                              setShowUserMenu(false);
                              setCurrentDiagramId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Sign Out
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="product-sign-in"
                    >
                      Sign In
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="relative flex-1 flex min-h-0 min-w-0 overflow-hidden">
          {diagramAccessState && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center bg-theme/95 px-6 py-10 backdrop-blur-sm"
              role={diagramAccessState === "loading" ? undefined : "dialog"}
              aria-labelledby="diagram-access-title"
              aria-describedby="diagram-access-description"
            >
              <div className="w-full max-w-lg rounded-2xl border border-theme/15 bg-surface p-8 text-center shadow-2xl">
                {diagramAccessState === "loading" && (
                  <div
                    className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-theme/15 border-t-accent"
                    aria-label="Loading diagram"
                  />
                )}
                {diagramAccessState === "requires-auth" && (
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-2xl">
                    🔒
                  </div>
                )}
                {diagramAccessState === "forbidden" && (
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-2xl">
                    🔐
                  </div>
                )}
                {(diagramAccessState === "not-found" ||
                  diagramAccessState === "error") && (
                  <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-2xl">
                    !
                  </div>
                )}

                <h2
                  id="diagram-access-title"
                  className="text-xl font-semibold text-theme"
                >
                  {diagramAccessState === "loading" && "Loading diagram…"}
                  {diagramAccessState === "requires-auth" &&
                    "Sign in to view this design"}
                  {diagramAccessState === "forbidden" &&
                    "This design belongs to another account"}
                  {diagramAccessState === "not-found" &&
                    "This design is no longer available"}
                  {diagramAccessState === "error" &&
                    "We couldn’t load this design"}
                </h2>
                <p
                  id="diagram-access-description"
                  className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted"
                >
                  {diagramAccessState === "loading" &&
                    "We’re checking the diagram link and preparing the canvas."}
                  {diagramAccessState === "requires-auth" &&
                    "This link points to a private or account-scoped design. Sign in to continue. After you sign in, we’ll return here and load it automatically."}
                  {diagramAccessState === "forbidden" &&
                    "The signed-in account does not have access to this design. Sign in with the account that owns it or use a public Diagramwise link."}
                  {diagramAccessState === "not-found" &&
                    "The link may be expired, deleted, or no longer shared with you."}
                  {diagramAccessState === "error" &&
                    "The diagram service could not load this link. Please try again."}
                </p>

                {diagramAccessState !== "loading" && (
                  <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                    {diagramAccessState === "requires-auth" && (
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-[var(--bg)] transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        Sign in to continue
                      </button>
                    )}
                    {diagramAccessState === "forbidden" && (
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setDiagramAccessState("requires-auth");
                          setShowAuthModal(true);
                        }}
                        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-[var(--bg)] transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        Sign in with another account
                      </button>
                    )}
                    {diagramAccessState === "error" && (
                      <button
                        type="button"
                        onClick={() => globalThis.location.reload()}
                        className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-[var(--bg)] transition hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        Try again
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onBack}
                      className="rounded-lg border border-theme/20 bg-theme/5 px-5 py-2.5 font-semibold text-theme transition hover:bg-theme/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      Back to Diagramwise
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {!isSharedView && (
            <ComponentPalette
              components={COMPONENTS}
              onAdd={addNodeFromPalette}
            />
          )}
          <DiagramCanvas
            readOnly={isSharedView}
            reactFlowWrapperRef={
              reactFlowWrapper as React.RefObject<HTMLDivElement>
            }
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={
              handleNodesChange as unknown as (...changes: unknown[]) => void
            }
            onEdgesChange={
              handleEdgesChange as unknown as (...changes: unknown[]) => void
            }
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeDragStop={onNodeDragStop}
            onMouseMove={handleCanvasMouseMove}
            onEdgeClick={handleEdgeClick}
          >
            {/* Render collaborator cursors (always shown when connected) */}
            {cursors.map((cursor) => {
              // Convert flow coordinates to screen coordinates for proper rendering
              const screenPosition = flowToScreenPosition(cursor.position);
              return (
                <CollaboratorCursor
                  key={cursor.userId}
                  name={cursor.user.name}
                  color={getCollaboratorColor(cursor.userId)}
                  position={screenPosition}
                  pictureUrl={cursor.user.pictureUrl}
                />
              );
            })}
          </DiagramCanvas>
          <InspectorPanel
            problem={problem}
            activeTab={activeRightTab}
            setActiveTab={setActiveRightTab}
            problemId={problem?.id ?? null}
            onApplyStep={handleApplyStep}
            guideCurrentStep={guideCurrentStep}
            onGuideStepChange={setGuideCurrentStep}
            inspectedNodeId={inspectedNodeId}
            setInspectedNodeId={setInspectedNodeId}
            inspectedEdgeId={inspectedEdgeId}
            setInspectedEdgeId={setInspectedEdgeId}
            propertyElements={propertyElements}
            customPropertyElements={customPropertyElements}
            edgePropertyElements={edgePropertyElements}
            onAddCustomProperty={handleAddCustomProperty}
            handleSave={handleSave}
            assessmentResult={assessment}
            assessmentHistory={assessmentHistory}
            addressedFindingIds={addressedFindingIds}
            onToggleFindingAddressed={toggleFindingAddressed}
            onReviewAgain={() => {
              setAssessment(null);
              void runAssessment();
            }}
            onDetachFromGroup={handleDetachFromGroup}
            isNodeInGroup={
              inspectedNodeId
                ? nodes.find((n) => n.id === inspectedNodeId)?.parentId !==
                  undefined
                : false
            }
            sharedCta={isSharedView ? (sharedCta ?? undefined) : undefined}
            onShareToWorld={
              !isSharedView &&
              ((idFromUrl && idFromUrl !== "free" && savedAttemptId) ||
                (currentDiagramId && currentDiagram?.isOwner !== false))
                ? () => setShowShareToWorldModal(true)
                : undefined
            }
            reasoningContext={reasoningContext}
            canvasStats={providedCanvasStats}
          />

          {extensionImportStatus && (
            <div
              className="absolute inset-0 z-[60] flex items-center justify-center bg-black/35 px-6 backdrop-blur-[2px]"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[var(--surface)]/95 p-6 text-center shadow-2xl">
                <div
                  className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[var(--brand)]/25 border-t-[var(--brand)]"
                  aria-hidden="true"
                />
                <p className="mt-4 text-sm font-semibold text-theme">
                  Importing schema
                </p>
                <p className="mt-2 text-sm text-muted">
                  {extensionImportStatus}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Large diagrams may take a moment to finish.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Clear Canvas Confirmation Modal */}
        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-theme/10">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-red-600 dark:text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-theme">
                    Clear Canvas?
                  </h3>
                  <p className="text-sm text-muted">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className="text-muted mb-4">
                Are you sure you want to clear all components and connections
                from the canvas? You will lose all your current work.
              </p>

              <div className="mb-4 flex items-start space-x-2">
                <input
                  id="clear-saved"
                  type="checkbox"
                  checked={clearSavedOnConfirm}
                  onChange={(e) => setClearSavedOnConfirm(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded text-theme"
                />
                <label htmlFor="clear-saved" className="text-sm text-muted">
                  Also delete saved progress (local or server). Use with
                  caution.
                </label>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={cancelClearCanvas}
                  className="flex-1 px-4 py-2 bg-theme/5 hover:bg-theme/10 text-theme font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmClearCanvas}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssessmentInterview && (
          <AssessmentInterviewDialog
            questions={assessmentInterviewQuestions}
            currentIndex={assessmentInterviewIndex}
            answer={assessmentInterviewAnswer}
            onAnswerChange={setAssessmentInterviewAnswer}
            onSubmit={() => advanceAssessmentInterview(false)}
            onSkip={() => advanceAssessmentInterview(true)}
            onCancel={cancelAssessmentInterview}
          />
        )}

        {/* Auth Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onLogin={async (email, password) => {
            await login({ email, password });
          }}
          onSignup={async (email, password, name) => {
            await signup({ email, password, name });
          }}
          onGoogleLogin={googleLogin}
        />

        {/* Share to the World Modal */}
        <ShareToWorldModal
          isOpen={showShareToWorldModal}
          onClose={() => setShowShareToWorldModal(false)}
          assessment={assessment}
          problem={problem ?? null}
          savedAttemptId={savedAttemptId}
          diagramId={savedAttemptId ? null : currentDiagramId}
          diagramTitle={
            savedAttemptId ? undefined : (currentDiagram?.title ?? undefined)
          }
          publicUrl={
            savedAttemptId || !currentDiagram?.publicSnapshotId
              ? null
              : `${window.location.origin}/public/${encodeURIComponent(currentDiagram.publicSnapshotId)}`
          }
          user={user}
          captureCanvasPng={captureCanvasPng}
          initiallyPublished={
            savedAttemptId ? isAttemptPublic : Boolean(currentDiagram?.isPublic)
          }
          onVisibilityChange={(isPublic, publicDiagramId) => {
            if (savedAttemptId) {
              setIsAttemptPublic(isPublic);
              return;
            }
            setCurrentDiagram((diagram) =>
              diagram
                ? {
                    ...diagram,
                    isPublic,
                    publicSnapshotId: isPublic
                      ? publicDiagramId || diagram.publicSnapshotId
                      : null,
                  }
                : diagram,
            );
          }}
        />

        {/* Project Intent Dialog - shown when entering Design Studio */}
        {showProjectIntentDialog && (
          <ProjectIntentDialog
            onSubmit={handleProjectIntentSubmit}
            onSkip={handleProjectIntentSkip}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.xml"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import diagram file"
        />

        <ExtensionHub
          isOpen={showExtensionHub}
          onClose={() => setShowExtensionHub(false)}
          onImport={handleExtensionImport}
          onImportDesign={handleImportClick}
          onExportImage={downloadImage}
          onExportJSON={handleExportJSON}
          onExportXML={handleExportXML}
          canExport={nodes.length > 0}
        />

        {/* Save Design Dialog (reuses ProjectIntentDialog) */}
        {showTitleDialog && (
          <ProjectIntentDialog
            onSubmit={handleTitleDialogConfirm}
            onSkip={handleTitleDialogCancel}
            initialTitle={userIntent?.title}
            initialDescription={userIntent?.description}
            heading="Save Your Design"
            subheading="Give your design a title so you can find it again later"
            submitLabel="Save Design"
          />
        )}

        {/* Share Design Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-lg shadow-xl border border-theme/10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-theme/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-theme">
                    Share Design
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="p-1 text-muted hover:text-theme rounded-md transition-colors"
                  >
                    <MdClose className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-muted mt-1">
                  Share "{currentDiagram?.title || "Untitled Design"}" with
                  others
                </p>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-6">
                {/* Add Collaborator Form */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-theme">
                    Add Collaborator
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="share-email"
                        className="block text-sm font-medium text-theme mb-2"
                      >
                        Email Address
                      </label>
                      <input
                        id="share-email"
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full px-3 py-2 border border-theme/20 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 bg-theme text-theme"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="share-permission"
                        className="block text-sm font-medium text-theme mb-2"
                      >
                        Permission Level
                      </label>
                      <select
                        id="share-permission"
                        value={sharePermission}
                        onChange={(e) =>
                          setSharePermission(e.target.value as "read" | "edit")
                        }
                        className="w-full px-3 py-2 border border-theme/20 rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 bg-theme text-theme"
                      >
                        <option value="read">
                          Read Only - Can view the diagram
                        </option>
                        <option value="edit">
                          Read & Edit - Can view and modify the diagram
                        </option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleShareDiagram}
                      disabled={!shareEmail.trim() || isSharing}
                      className="w-full px-4 py-2 bg-accent text-[var(--bg)] rounded-md hover:brightness-90 transition-all disabled:bg-[var(--muted)] disabled:text-[var(--bg)] disabled:opacity-100 disabled:hover:brightness-100 disabled:cursor-not-allowed"
                    >
                      {isSharing ? "Sharing..." : "Share Design"}
                    </button>
                  </div>
                </div>

                {/* Current Collaborators */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-theme">
                    Current Collaborators
                  </h3>
                  <CollaboratorsList
                    isLoading={isLoadingCollaborators}
                    collaborators={collaborators}
                    onUpdatePermission={handleUpdateCollaboratorPermission}
                    onRemove={handleRemoveCollaborator}
                  />
                </div>

                {/* Share Link */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-theme">Share Link</h3>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={`${globalThis.location.origin}/#/playground/free?diagramId=${currentDiagramId}`}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-theme/20 rounded-md bg-theme/50 text-theme"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${globalThis.location.origin}/#/playground/free?diagramId=${currentDiagramId}`,
                        );
                        toast.success("Link copied to clipboard!");
                      }}
                      className="px-3 py-2 bg-theme/10 hover:bg-theme/20 text-theme rounded-md transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    Anyone with this link can access the diagram according to
                    their permission level
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

        {/* Chat Bot - Only for free mode (Design Studio) */}
        {idFromUrl === "free" && (
          <div data-tour="chatbot-btn">
            <ChatBot
              canvasContext={canvasContext}
              nodes={nodes}
              edges={edges}
              onAddComponent={addNodeFromPalette}
            />
          </div>
        )}
      </div>
    </>
  );
};

// Wrap with ReactFlowProvider to enable useReactFlow hook
const SystemDesignPlaygroundWithProvider = () => (
  <ReactFlowProvider>
    <SystemDesignPlayground />
  </ReactFlowProvider>
);

export default SystemDesignPlaygroundWithProvider;
