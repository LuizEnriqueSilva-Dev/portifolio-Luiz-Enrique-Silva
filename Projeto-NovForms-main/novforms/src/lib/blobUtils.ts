/**
 * Utility to generate SVG blob paths.
 */

export interface BlobOptions {
  size: number;
  growth: number; // contrast/randomness (0-10)
  edges: number;  // complexity/points (3-20)
  seed: number;
  smoothness?: number; // 0-1
}

export function generateBlobPath(options: BlobOptions): string {
  const { size, growth, edges, seed, smoothness = 1 } = options;
  
  const random = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  const center = size / 2;
  const radius = size / 3;
  const points: { x: number; y: number }[] = [];
  const angleStep = (Math.PI * 2) / edges;

  for (let i = 0; i < edges; i++) {
    const angle = i * angleStep;
    const variance = (random(i) * growth * radius) / 10;
    const r = radius + variance;
    
    points.push({
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    });
  }

  // Create a smooth path using Catmull-Rom to Bezier conversion or similar
  // For simplicity and "smoothness" control, we'll use a weighted midpoint approach
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < edges; i++) {
    const p0 = points[(i - 1 + edges) % edges];
    const p1 = points[i];
    const p2 = points[(i + 1) % edges];
    const p3 = points[(i + 2) % edges];
    
    // Control points based on smoothness
    const cp1x = p1.x + (p2.x - p0.x) * 0.2 * smoothness;
    const cp1y = p1.y + (p2.y - p0.y) * 0.2 * smoothness;
    const cp2x = p2.x - (p3.x - p1.x) * 0.2 * smoothness;
    const cp2y = p2.y - (p3.y - p1.y) * 0.2 * smoothness;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  path += " Z";
  return path;
}
