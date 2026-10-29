import { useEffect, type RefObject } from "react";
type RoughNotationModule = typeof import("rough-notation");
type Annotate = RoughNotationModule["annotate"];
type RoughAnnotationConfig = Omit<
  Parameters<Annotate>[1],
  "brackets" | "padding"
> & {
  brackets?: string | string[];
  padding?: number | number[];
};
type RoughAnnotation = ReturnType<Annotate>;

type AnnotationTarget = {
  ref: RefObject<HTMLElement | null>;
  config: RoughAnnotationConfig;
};

/**
 * Shows a small, non-interactive markup layer over important learning cues.
 * Targets remain normal DOM content so annotations never become required
 * to understand or operate the page.
 */
export const useRoughAnnotation = (
  targets: AnnotationTarget[],
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let frameId: number | undefined;
    let idleId: number | undefined;
    let annotations: RoughAnnotation[] = [];

    const renderAnnotations = async () => {
      const { annotate, annotationGroup } = await import("rough-notation");
      if (cancelled) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      annotations = targets.flatMap(({ ref, config }) =>
        ref.current
          ? [
              annotate(ref.current, {
                ...config,
                animate: config.animate ?? !prefersReducedMotion,
              } as Parameters<typeof annotate>[1]),
            ]
          : [],
      );

      if (annotations.length === 0 || cancelled) return;
      const group = annotationGroup(annotations);
      frameId = window.requestAnimationFrame(() => group.show());
    };

    const idleWindow = window as unknown as {
      requestIdleCallback?: typeof window.requestIdleCallback;
      cancelIdleCallback?: typeof window.cancelIdleCallback;
    };

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(() => void renderAnnotations(), {
        timeout: 4000,
      });
    } else {
      frameId = window.requestAnimationFrame(() => void renderAnnotations());
    }

    return () => {
      cancelled = true;
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (frameId !== undefined) window.cancelAnimationFrame(frameId);
      annotations.forEach((annotation) => annotation.remove());
    };
  }, [enabled, targets]);
};
