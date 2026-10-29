import type { GuideArchitectureComponent } from "../types/problemGuide";
import type { SystemConnection } from "../types/systemDesign";

export type ArchitectureHandlePair = {
  sourceHandle: string;
  targetHandle: string;
};

const POSITION_EPSILON = 1;

const isBetween = (value: number, first: number, second: number) =>
  value > Math.min(first, second) && value < Math.max(first, second);

const getClearance = (
  components: GuideArchitectureComponent[],
  axis: "x" | "y",
  position: number,
  direction: -1 | 1,
  rangeAxis: "x" | "y",
  rangeStart: number,
  rangeEnd: number,
) => {
  const lowerBound = Math.min(rangeStart, rangeEnd);
  const upperBound = Math.max(rangeStart, rangeEnd);
  const distances = components
    .filter((component) => {
      const rangePosition = component.position[rangeAxis];
      return rangePosition >= lowerBound && rangePosition <= upperBound;
    })
    .map((component) => component.position[axis] - position)
    .filter((distance) => (direction < 0 ? distance < 0 : distance > 0))
    .map((distance) => Math.abs(distance));

  return distances.length > 0
    ? Math.min(...distances)
    : Number.POSITIVE_INFINITY;
};

const getDetourSide = (
  components: GuideArchitectureComponent[],
  axis: "x" | "y",
  position: number,
  rangeAxis: "x" | "y",
  rangeStart: number,
  rangeEnd: number,
): -1 | 1 => {
  const negativeClearance = getClearance(
    components,
    axis,
    position,
    -1,
    rangeAxis,
    rangeStart,
    rangeEnd,
  );
  const positiveClearance = getClearance(
    components,
    axis,
    position,
    1,
    rangeAxis,
    rangeStart,
    rangeEnd,
  );

  return positiveClearance >= negativeClearance ? 1 : -1;
};

const getVerticalHandlePair = (
  source: GuideArchitectureComponent,
  target: GuideArchitectureComponent,
  components: GuideArchitectureComponent[],
): ArchitectureHandlePair => {
  const deltaY = target.position.y - source.position.y;
  const hasIntermediateComponent = components.some(
    (component) =>
      component.id !== source.id &&
      component.id !== target.id &&
      Math.abs(component.position.x - source.position.x) < POSITION_EPSILON &&
      isBetween(component.position.y, source.position.y, target.position.y),
  );

  if (hasIntermediateComponent) {
    const side = getDetourSide(
      components,
      "x",
      source.position.x,
      "y",
      source.position.y,
      target.position.y,
    );
    return side > 0
      ? { sourceHandle: "right", targetHandle: "right" }
      : { sourceHandle: "left", targetHandle: "left" };
  }

  return deltaY > 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
};

const getHorizontalHandlePair = (
  source: GuideArchitectureComponent,
  target: GuideArchitectureComponent,
  components: GuideArchitectureComponent[],
): ArchitectureHandlePair => {
  const deltaX = target.position.x - source.position.x;
  const hasIntermediateComponent = components.some(
    (component) =>
      component.id !== source.id &&
      component.id !== target.id &&
      Math.abs(component.position.y - source.position.y) < POSITION_EPSILON &&
      isBetween(component.position.x, source.position.x, target.position.x),
  );

  if (hasIntermediateComponent) {
    const side = getDetourSide(
      components,
      "y",
      source.position.y,
      "x",
      source.position.x,
      target.position.x,
    );
    return side > 0
      ? { sourceHandle: "bottom", targetHandle: "bottom" }
      : { sourceHandle: "top", targetHandle: "top" };
  }

  return deltaX > 0
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: "left", targetHandle: "right" };
};

/**
 * Infer handles for public architecture edges while keeping persisted guide
 * properties as the final override. Equal-axis links use a detour when an
 * intermediate component would otherwise hide the edge path.
 */
export const getDefaultArchitectureHandlePair = (
  connection: SystemConnection,
  components: GuideArchitectureComponent[],
): ArchitectureHandlePair => {
  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );
  const source = componentsById.get(connection.source);
  const target = componentsById.get(connection.target);

  if (!source || !target) {
    return { sourceHandle: "right", targetHandle: "left" };
  }

  const deltaX = target.position.x - source.position.x;
  const deltaY = target.position.y - source.position.y;
  const sameX = Math.abs(deltaX) < POSITION_EPSILON;
  const sameY = Math.abs(deltaY) < POSITION_EPSILON;

  if (sameX && !sameY) return getVerticalHandlePair(source, target, components);
  if (sameY && !sameX)
    return getHorizontalHandlePair(source, target, components);

  if (deltaX > 0) {
    return { sourceHandle: "right", targetHandle: "left" };
  }

  if (deltaX < 0) {
    return { sourceHandle: "left", targetHandle: "right" };
  }

  return deltaY > 0
    ? { sourceHandle: "bottom", targetHandle: "top" }
    : { sourceHandle: "top", targetHandle: "bottom" };
};
