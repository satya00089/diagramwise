import { useId, useState, type ReactNode } from "react";
import { MiniMap, Panel } from "@xyflow/react";
import { MdExpandLess, MdExpandMore } from "react-icons/md";

type InsetTab = "traffic" | "map";

const TAB_STORAGE_KEY = "canvas-inset-tab";
const COLLAPSED_STORAGE_KEY = "canvas-inset-collapsed";

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable; the choice still holds for this session.
  }
}

/**
 * The canvas's bottom-right corner: the minimap, or, while a simulation is
 * open, a choice between the run's traffic and the minimap. Traffic is the
 * default because it is what a reader watches during a run; a reader who
 * prefers the map keeps it for later runs.
 *
 * The body is only as tall as the traffic content, and the map fills that
 * same height, so no tab carries empty space and switching never resizes the
 * corner. The chevron folds the body away, leaving only the tab strip, to
 * give the canvas the room back.
 */
export function CanvasInset({
  traffic,
  map = true,
}: Readonly<{
  traffic?: ReactNode;
  /** False where the page has no minimap, leaving a Traffic-only panel. */
  map?: boolean;
}>) {
  const id = useId();
  const [tab, setTab] = useState<InsetTab>(() =>
    map && readStored(TAB_STORAGE_KEY) === "map" ? "map" : "traffic",
  );
  const [collapsed, setCollapsed] = useState(
    () => readStored(COLLAPSED_STORAGE_KEY) === "1",
  );
  if (!traffic) return <MiniMap nodeStrokeWidth={3} />;

  const choose = (next: InsetTab) => {
    setTab(next);
    writeStored(TAB_STORAGE_KEY, next);
    // Picking a tab is asking to see it, so it opens a folded panel.
    if (collapsed) toggle(false);
  };
  const toggle = (next: boolean) => {
    setCollapsed(next);
    writeStored(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  };
  const tabs: { value: InsetTab; label: string }[] = [
    { value: "traffic", label: "Traffic" },
    ...(map ? [{ value: "map" as const, label: "Map" }] : []),
  ];
  const bodyId = `${id}-body`;

  return (
    <Panel
      position="bottom-right"
      className={`canvas-inset nodrag nopan${collapsed ? " canvas-inset--collapsed" : ""}`}
    >
      {/* Tabs sit under the body, where a reader's eye leaves the minimap. */}
      {!collapsed && (
        <div
          role="tabpanel"
          id={bodyId}
          aria-labelledby={`${id}-${tab}-tab`}
          className="canvas-inset__body"
        >
          {/* Always mounted, so it sets the height the map then fills. */}
          <div
            className={`canvas-inset__layer${tab === "traffic" ? "" : " canvas-inset__layer--hidden"}`}
          >
            {traffic}
          </div>
          {tab === "map" && (
            <MiniMap nodeStrokeWidth={3} className="canvas-inset__map" />
          )}
        </div>
      )}
      <div className="canvas-inset__bar">
        <div
          className="canvas-inset__tabs"
          role="tablist"
          aria-label="Canvas inset"
        >
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`${id}-${item.value}-tab`}
              aria-selected={tab === item.value}
              aria-controls={collapsed ? undefined : bodyId}
              className="canvas-inset__tab"
              onClick={() => choose(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="canvas-inset__toggle"
          aria-expanded={!collapsed}
          aria-controls={collapsed ? undefined : bodyId}
          aria-label={collapsed ? "Show panel" : "Hide panel"}
          data-tooltip={collapsed ? "Show panel" : "Hide panel"}
          data-tooltip-placement="top"
          onClick={() => toggle(!collapsed)}
        >
          {collapsed ? (
            <MdExpandLess aria-hidden="true" size={16} />
          ) : (
            <MdExpandMore aria-hidden="true" size={16} />
          )}
        </button>
      </div>
    </Panel>
  );
}
