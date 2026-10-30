/**
 * Rules for when a `data-tooltip` should stay quiet. The adaptive tooltip layer
 * calls these; keeping them here lets every tooltip in the app share one
 * definition instead of each component working around the layer.
 */

/** The parts of an element these rules read, so they are easy to test. */
export type TooltipElement = Pick<
  Element,
  "hasAttribute" | "getAttribute" | "querySelector"
>;

const EXPANDED_SELECTOR = '[aria-expanded="true"]';

// Popups that are open inside a tooltip's element. The ARIA roles cover custom
// menus and dialogs that are rendered inline (not portaled out of the element).
const OPEN_POPUP_SELECTORS = [
  EXPANDED_SELECTOR,
  '[role="listbox"]',
  '[role="menu"]',
  '[role="dialog"]',
  "details[open]",
  "dialog[open]",
  "[popover]:popover-open",
];

/**
 * True while the element, or something inside it such as a select trigger, has
 * an open popup. A tooltip describes a closed control: once the popup is open
 * it takes over, so hovering its options must not keep the tooltip up.
 */
export function hasOpenPopup(element: TooltipElement): boolean {
  if (element.getAttribute("aria-expanded") === "true") return true;
  try {
    return element.querySelector(OPEN_POPUP_SELECTORS.join(",")) !== null;
  } catch {
    // Older browsers reject :popover-open; fall back to the ARIA signal.
    return element.querySelector(EXPANDED_SELECTOR) !== null;
  }
}

/** True when a tooltip must not show for this element right now. */
export function isTooltipSuppressed(element: TooltipElement): boolean {
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    hasOpenPopup(element)
  );
}
