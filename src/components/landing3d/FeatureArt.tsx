import { useEffect, useRef } from "react";
import { useTheme } from "../../hooks/useTheme";

const figures = {
  design: ["workbench", "Place a service in a system architecture"],
  reason: ["switchback", "Open a lesson along a learning path"],
  review: ["inspection-stack", "Inspect an architecture connection"],
  canvas: ["drafting-board", "Place the first component on a blank canvas"],
} as const;

export default function FeatureArt({
  type,
}: Readonly<{ type: keyof typeof figures }>) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stateRef = useRef({ active: false, x: 200 });
  const { flowColorMode } = useTheme();
  const [name, label] = figures[type];

  const send = () =>
    frameRef.current?.contentWindow?.postMessage(
      { type: "diagramwise:figure", ...stateRef.current },
      window.location.origin,
    );

  useEffect(() => {
    const frame = frameRef.current;
    const card = frame?.closest<HTMLAnchorElement>(".systema-feature");
    if (!frame || !card) return;
    const move = (event: PointerEvent) => {
      const bounds = frame.getBoundingClientRect();
      stateRef.current = {
        active: true,
        x: bounds.width
          ? ((event.clientX - bounds.left) / bounds.width) * 400
          : 200,
      };
      send();
    };
    const focus = () => {
      stateRef.current = { active: true, x: 200 };
      send();
    };
    const leave = () => {
      stateRef.current = { active: card.matches(":focus-visible"), x: 200 };
      send();
    };
    const blur = () => {
      stateRef.current = { active: false, x: 200 };
      send();
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerdown", move);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focus", focus);
    card.addEventListener("blur", blur);
    return () => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerdown", move);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focus", focus);
      card.removeEventListener("blur", blur);
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      className="systema-feature-art"
      src={`/path-figures/embed/${name}.html?theme=${flowColorMode}&v=2`}
      title={label}
      aria-hidden="true"
      tabIndex={-1}
      loading="lazy"
      onLoad={send}
    />
  );
}
