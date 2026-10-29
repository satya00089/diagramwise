import { useLayoutEffect, useRef, useState } from "react";
import { NavIcon } from "./navIcons/NavIcon";
import type { StoryIconName } from "./navIcons/NavIcon";
import { LABEL_GAP, tabsShowingLabel } from "./tabLabelFit";

/**
 * Single-row tab strip with three states, chosen by available width:
 *   1. every tab shows its label;
 *   2. only the active tab shows its label;
 *   3. icons only.
 * A tab without a label shows its name as a tooltip.
 */

export type SidebarTab<T extends string> = Readonly<{
  id: T;
  label: string;
  icon: StoryIconName;
  tour?: string;
}>;

type Props<T extends string> = Readonly<{
  tabs: readonly SidebarTab<T>[];
  active: T;
  onSelect: (id: T) => void;
}>;

export function SidebarTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: Props<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<readonly string[]>(
    tabs.map((t) => t.id),
  );
  // Callers usually build `tabs` inline, so it is a new array every render.
  // Key the effect on its content instead, to keep one resize observer.
  const layoutKey = tabs.map((t) => `${t.id}:${t.label}`).join("|");
  const idsRef = useRef<string[]>([]);
  idsRef.current = tabs.map((t) => t.id);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;

    const compute = () => {
      const labelWidths = new Map<string, number>();
      for (const el of Array.from(measure.children)) {
        labelWidths.set(
          (el as HTMLElement).dataset.id ?? "",
          el.getBoundingClientRect().width + LABEL_GAP,
        );
      }
      const ordered = tabsShowingLabel(
        idsRef.current,
        active,
        labelWidths,
        wrap.clientWidth,
      );
      setExpanded((prev) =>
        prev.join("|") === ordered.join("|") ? prev : ordered,
      );
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [active, layoutKey]);

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Off-screen copy of the labels, only to measure their text widths. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 h-0 overflow-hidden whitespace-nowrap"
      >
        {tabs.map((tab) => (
          <span
            key={tab.id}
            data-id={tab.id}
            className="inline-block text-sm font-medium"
          >
            {tab.label}
          </span>
        ))}
      </div>

      <div
        className="flex flex-nowrap items-center gap-2"
        role="tablist"
        aria-label="Sidebar tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const showLabel = expanded.includes(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              data-tooltip={showLabel ? undefined : tab.label}
              data-tour={tab.tour}
              className={`nav-trigger flex shrink-0 items-center rounded-t-md px-3 py-2 transition-colors ${isActive ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "text-theme hover:bg-[var(--bg-hover)]"}`}
              onClick={() => onSelect(tab.id)}
            >
              <NavIcon name={tab.icon} />
              <span
                aria-hidden="true"
                className={`grid transition-[grid-template-columns] duration-150 motion-reduce:transition-none ${showLabel ? "grid-cols-[1fr]" : "grid-cols-[0fr]"}`}
              >
                <span className="overflow-hidden">
                  <span className="block whitespace-nowrap pl-2 text-sm font-medium">
                    {tab.label}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SidebarTabs;
