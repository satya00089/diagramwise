/**
 * Live-collaboration room for one canvas of a design.
 *
 * The design's first canvas (the one whose ID equals the design ID) keeps the
 * design's room name, so sessions opened before multi-canvas still share a room.
 * Other canvases get their own room, so collaborators on different tabs never
 * share one live document.
 */
export function canvasRoomId(designId: string, canvasId: string): string {
  return canvasId === designId ? designId : `${designId}~${canvasId}`;
}
