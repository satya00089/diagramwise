import { create } from "zustand";
import type {
  CompiledSimulation,
  SimulationDocument,
} from "@diagramwise/simulation-core/compiler";
import type {
  SimSnapshot,
  Topology,
  TrafficPattern,
} from "@diagramwise/simulation-core";
import type { SimulationStatus } from "../components/simulation/types";
import type {
  EventRunArtifact,
  RecordedCommand,
  SimulationScope,
} from "./protocol";

export type SessionState = {
  scope: SimulationScope | null;
  document: SimulationDocument | null;
  compilation: CompiledSimulation | null;
  status: SimulationStatus;
  visible: boolean;
  snapshot: SimSnapshot | null;
  rps: number;
  pattern: TrafficPattern;
  speed: number;
  seed: number;
  achievedSpeed: number;
  commands: RecordedCommand[];
  initialTopology: Topology | null;
  initialWorkload: EventRunArtifact["workload"] | null;
  runFingerprint: string;
  selectedNodeId: string | null;
  error: string | null;
};

export const initialSessionState: SessionState = {
  scope: null,
  document: null,
  compilation: null,
  status: "idle",
  visible: false,
  snapshot: null,
  rps: 100,
  pattern: "steady",
  speed: 1,
  seed: 1,
  achievedSpeed: 1,
  commands: [],
  initialTopology: null,
  initialWorkload: null,
  runFingerprint: "",
  selectedNodeId: null,
  error: null,
};

export const useSimulationSession = create<SessionState>(
  () => initialSessionState,
);
