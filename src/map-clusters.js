// Greedy screen-space grouping: nearby places share a marker, never a label pile.
export function clusterMarkers(points, radius = 26) {
  const groups = [];
  for (const point of points) {
    const group = groups.find(g => Math.hypot(g.x - point.x, g.y - point.y) < radius);
    if (group) group.points.push(point);
    else groups.push({ x: point.x, y: point.y, points: [point] });
  }
  return groups;
}
