import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  hasOpenPopup,
  isTooltipSuppressed,
} from "../../utils/tooltipVisibility";

type TooltipPlacement = "top" | "right" | "bottom" | "left";

type TooltipState = {
  element: HTMLElement;
  text: string;
  placement: TooltipPlacement;
  left: number;
  top: number;
  arrowOffset: number;
};

const VIEWPORT_PADDING = 12;
const TOOLTIP_GAP = 8;

const getTooltipTarget = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(
    '[data-tooltip]:not([data-tooltip=""])',
  );
  if (!element?.isConnected) return null;
  if (isTooltipSuppressed(element)) return null;
  return element;
};

const markTooltipTargets = (root: ParentNode = document) => {
  root
    .querySelectorAll<HTMLElement>('[data-tooltip]:not([data-tooltip=""])')
    .forEach((element) => {
      element.dataset.tooltipRender = "portal";
      const title = element.getAttribute("title")?.trim();
      if (
        title &&
        !element.getAttribute("aria-label") &&
        !element.textContent?.trim()
      ) {
        element.setAttribute("aria-label", title);
      }
      element.removeAttribute("title");
    });
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const isTooltipPlacement = (
  value: string | undefined,
): value is TooltipPlacement =>
  value === "top" ||
  value === "right" ||
  value === "bottom" ||
  value === "left";

const getTooltipLayout = (
  element: HTMLElement,
  text: string,
): Omit<TooltipState, "element" | "text"> => {
  const anchor = element.getBoundingClientRect();
  const measure = document.createElement("div");
  measure.className = "app-tooltip adaptive-tooltip-measure";
  measure.textContent = text;
  measure.setAttribute("aria-hidden", "true");
  measure.style.cssText =
    "position:fixed;visibility:hidden;display:block;pointer-events:none;width:max-content;";
  document.body.appendChild(measure);
  const { width, height } = measure.getBoundingClientRect();
  measure.remove();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const available = {
    bottom: viewportHeight - anchor.bottom - VIEWPORT_PADDING,
    top: anchor.top - VIEWPORT_PADDING,
    right: viewportWidth - anchor.right - VIEWPORT_PADDING,
    left: anchor.left - VIEWPORT_PADDING,
  } satisfies Record<TooltipPlacement, number>;
  const required = {
    bottom: height + TOOLTIP_GAP,
    top: height + TOOLTIP_GAP,
    right: width + TOOLTIP_GAP,
    left: width + TOOLTIP_GAP,
  } satisfies Record<TooltipPlacement, number>;
  const requestedPlacement = element.dataset.tooltipPlacement;
  const preferred: TooltipPlacement[] = isTooltipPlacement(requestedPlacement)
    ? [
        requestedPlacement,
        ...(["top", "right", "bottom", "left"] as TooltipPlacement[]).filter(
          (side) => side !== requestedPlacement,
        ),
      ]
    : ["bottom", "top", "right", "left"];
  const placement = isTooltipPlacement(requestedPlacement)
    ? requestedPlacement
    : (preferred.find((side) => available[side] >= required[side]) ??
      preferred.reduce<TooltipPlacement>(
        (best, side) => (available[side] > available[best] ? side : best),
        "bottom",
      ));

  const maxLeft = viewportWidth - VIEWPORT_PADDING - width;
  const maxTop = viewportHeight - VIEWPORT_PADDING - height;
  let left = anchor.left + anchor.width / 2 - width / 2;
  let top = anchor.bottom + TOOLTIP_GAP;

  if (placement === "top") {
    top = anchor.top - height - TOOLTIP_GAP;
  } else if (placement === "right") {
    left = anchor.right + TOOLTIP_GAP;
    top = anchor.top + anchor.height / 2 - height / 2;
  } else if (placement === "left") {
    left = anchor.left - width - TOOLTIP_GAP;
    top = anchor.top + anchor.height / 2 - height / 2;
  }

  const clampedLeft = clamp(left, VIEWPORT_PADDING, maxLeft);
  const clampedTop = clamp(top, VIEWPORT_PADDING, maxTop);
  const arrowOffset =
    placement === "top" || placement === "bottom"
      ? clamp(
          anchor.left + anchor.width / 2 - clampedLeft,
          12,
          Math.max(12, width - 12),
        )
      : clamp(
          anchor.top + anchor.height / 2 - clampedTop,
          12,
          Math.max(12, height - 12),
        );

  return {
    placement,
    left: clampedLeft,
    top: clampedTop,
    arrowOffset,
  };
};

const AdaptiveTooltipLayer = () => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<TooltipState | null>(null);

  useEffect(() => {
    let frame = 0;

    const showTooltip = (element: HTMLElement) => {
      const text = element.dataset.tooltip?.trim();
      if (!text) return;
      markTooltipTargets(element.parentElement ?? document);
      const layout = getTooltipLayout(element, text);
      const nextTooltip = { element, text, ...layout };
      tooltipRef.current = nextTooltip;
      setTooltip(nextTooltip);
    };

    const hideTooltip = (element?: HTMLElement) => {
      const current = tooltipRef.current;
      if (!element || current?.element === element) {
        tooltipRef.current = null;
        setTooltip(null);
      }
    };

    const handlePointerOver = (event: PointerEvent) => {
      const element = getTooltipTarget(event.target);
      if (!element) return;
      if (
        event.relatedTarget instanceof Node &&
        element.contains(event.relatedTarget)
      ) {
        return;
      }
      showTooltip(element);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const element = getTooltipTarget(event.target);
      if (!element) return;
      if (
        event.relatedTarget instanceof Node &&
        element.contains(event.relatedTarget)
      ) {
        return;
      }
      if (!element.matches(":focus-visible")) hideTooltip(element);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const element = getTooltipTarget(event.target);
      if (element) showTooltip(element);
    };

    const handleFocusOut = (event: FocusEvent) => {
      const element = getTooltipTarget(event.target);
      if (element && !element.matches(":hover")) hideTooltip(element);
    };

    const reposition = () => {
      const current = tooltipRef.current;
      if (!current?.element.isConnected) {
        hideTooltip();
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => showTooltip(current.element));
    };

    const observer = new MutationObserver(() => {
      markTooltipTargets();
      // Follow the hovered element: a tooltip that changes or is removed while
      // the pointer is still over it (a "Restart" button that becomes "Pause")
      // must not keep showing its old text.
      const current = tooltipRef.current;
      if (!current) return;
      const text = current.element.dataset.tooltip?.trim();
      if (
        !current.element.isConnected ||
        !text ||
        hasOpenPopup(current.element)
      )
        hideTooltip();
      else if (text !== current.text) showTooltip(current.element);
    });
    markTooltipTargets();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tooltip", "title", "aria-expanded"],
    });
    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, {
      passive: true,
      capture: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, []);

  if (!tooltip) return null;

  return createPortal(
    <div
      className={`app-tooltip adaptive-tooltip-layer adaptive-tooltip-layer--${tooltip.placement}`}
      role="tooltip"
      style={
        {
          left: tooltip.left,
          top: tooltip.top,
          "--tooltip-arrow-offset": `${tooltip.arrowOffset}px`,
        } as CSSProperties
      }
    >
      {tooltip.text}
      <span className="app-tooltip__arrow" aria-hidden="true" />
    </div>,
    document.body,
  );
};

export default AdaptiveTooltipLayer;
