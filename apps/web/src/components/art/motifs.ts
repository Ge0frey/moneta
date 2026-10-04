/**
 * Moneta ASCII motifs as surface point clouds with normals. Sampled once; each frame rotates,
 * projects, z-buffers and shades them into a character grid. Units are arbitrary; shapes are centred near origin.
 */
export type Pt = { x: number; y: number; z: number; nx: number; ny: number; nz: number };
export type Motif = "temple" | "fork" | "coins" | "scale" | "cubes";

function box(
  out: Pt[],
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  d: number,
) {
  const h = [sx / 2, sy / 2, sz / 2];
  const c = [cx, cy, cz];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [-1, 1]) {
      const a = (axis + 1) % 3;
      const b = (axis + 2) % 3;
      for (let u = -h[a]!; u <= h[a]! + 1e-6; u += d) {
        for (let v = -h[b]!; v <= h[b]! + 1e-6; v += d) {
          const p = [0, 0, 0];
          const n = [0, 0, 0];
          p[axis] = sign * h[axis]!;
          p[a] = u;
          p[b] = v;
          n[axis] = sign;
          out.push({
            x: c[0]! + p[0]!,
            y: c[1]! + p[1]!,
            z: c[2]! + p[2]!,
            nx: n[0]!,
            ny: n[1]!,
            nz: n[2]!,
          });
        }
      }
    }
  }
}

function cylinder(
  out: Pt[],
  cx: number,
  cz: number,
  r: number,
  y0: number,
  y1: number,
  d: number,
  caps = true,
) {
  const steps = Math.max(12, Math.round((2 * Math.PI * r) / d));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const nx = Math.cos(t),
      nz = Math.sin(t);
    for (let y = y0; y <= y1 + 1e-6; y += d)
      out.push({ x: cx + nx * r, y, z: cz + nz * r, nx, ny: 0, nz });
  }
  if (!caps) return;
  for (let rr = d; rr < r; rr += d) {
    const s = Math.max(6, Math.round((2 * Math.PI * rr) / d));
    for (let i = 0; i < s; i++) {
      const t = (i / s) * Math.PI * 2;
      out.push({ x: cx + Math.cos(t) * rr, y: y1, z: cz + Math.sin(t) * rr, nx: 0, ny: 1, nz: 0 });
      out.push({ x: cx + Math.cos(t) * rr, y: y0, z: cz + Math.sin(t) * rr, nx: 0, ny: -1, nz: 0 });
    }
  }
}

/** Triangular prism (pediment) extruded along z: base width w at y0, apex height h. */
function pediment(out: Pt[], w: number, y0: number, h: number, depth: number, d: number) {
  const slope = Math.hypot(w / 2, h);
  const nyS = w / 2 / slope,
    nxS = h / slope;
  for (let z = -depth / 2; z <= depth / 2 + 1e-6; z += d) {
    for (let s = 0; s <= 1 + 1e-6; s += d / slope) {
      out.push({ x: -w / 2 + (w / 2) * s, y: y0 + h * s, z, nx: -nxS, ny: nyS, nz: 0 });
      out.push({ x: w / 2 - (w / 2) * s, y: y0 + h * s, z, nx: nxS, ny: nyS, nz: 0 });
    }
  }
  for (const zf of [-depth / 2, depth / 2]) {
    for (let y = y0; y <= y0 + h; y += d) {
      const half = (w / 2) * (1 - (y - y0) / h);
      for (let x = -half; x <= half; x += d)
        out.push({ x, y, z: zf, nx: 0, ny: 0, nz: Math.sign(zf) });
    }
  }
}

/** Tube along a polyline path. */
function tube(out: Pt[], path: [number, number, number][], r: number, d: number) {
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay, az] = path[i]!,
      [bx, by, bz] = path[i + 1]!;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const tx = (bx - ax) / len,
      ty = (by - ay) / len,
      tz = (bz - az) / len;
    // orthonormal frame
    let ux = -ty,
      uy = tx,
      uz = 0;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = ty * uz - tz * uy,
      vy = tz * ux - tx * uz,
      vz = tx * uy - ty * ux;
    const ring = Math.max(10, Math.round((2 * Math.PI * r) / d));
    for (let s = 0; s <= len; s += d) {
      const px = ax + tx * s,
        py = ay + ty * s,
        pz = az + tz * s;
      for (let k = 0; k < ring; k++) {
        const t = (k / ring) * Math.PI * 2;
        const nx = Math.cos(t) * ux + Math.sin(t) * vx;
        const ny = Math.cos(t) * uy + Math.sin(t) * vy;
        const nz = Math.cos(t) * uz + Math.sin(t) * vz;
        out.push({ x: px + nx * r, y: py + ny * r, z: pz + nz * r, nx, ny, nz });
      }
    }
  }
}

function bezier(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  n: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    const f = (k: number) =>
      u * u * u * p0[k]! + 3 * u * u * t * p1[k]! + 3 * u * t * t * p2[k]! + t * t * t * p3[k]!;
    out.push([f(0), f(1), f(2)]);
  }
  return out;
}

const cache = new Map<string, Pt[]>();

/** Surface points for a motif; `d` = sampling step (smaller = denser; ~char width in scene units). */
export function motifPoints(m: Motif, d = 0.045): Pt[] {
  const key = `${m}:${d}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pts: Pt[] = [];
  if (m === "temple") {
    // stylobate (three steps), six columns, entablature, pediment — the temple of Juno Moneta
    box(pts, 0, -1.05, 0, 2.6, 0.12, 1.3, d);
    box(pts, 0, -0.93, 0, 2.4, 0.12, 1.15, d);
    box(pts, 0, -0.81, 0, 2.2, 0.12, 1.0, d);
    for (let i = 0; i < 6; i++) cylinder(pts, -0.95 + i * 0.38, 0.25, 0.1, -0.75, 0.45, d, false);
    for (let i = 0; i < 6; i++) cylinder(pts, -0.95 + i * 0.38, -0.25, 0.1, -0.75, 0.45, d, false);
    box(pts, 0, 0.56, 0, 2.3, 0.2, 0.95, d);
    pediment(pts, 2.3, 0.66, 0.45, 0.95, d);
  } else if (m === "fork") {
    // one stream splitting into two worlds that reconverge
    tube(pts, bezier([-1.6, 0, 0], [-1.0, 0, 0], [-0.6, 0, 0], [-0.4, 0, 0], 8), 0.13, d);
    tube(
      pts,
      bezier([-0.4, 0, 0], [0.2, 0.05, 0], [0.4, 0.7, 0.2], [1.0, 0.75, 0.25], 16),
      0.12,
      d,
    );
    tube(
      pts,
      bezier([-0.4, 0, 0], [0.2, -0.05, 0], [0.4, -0.7, -0.2], [1.0, -0.75, -0.25], 16),
      0.12,
      d,
    );
    cylinder(pts, 1.25, 0.25, 0.22, 0.6, 0.9, d);
    cylinder(pts, 1.25, -0.25, 0.22, -0.9, -0.6, d);
  } else if (m === "coins") {
    for (let i = 0; i < 7; i++)
      cylinder(
        pts,
        Math.sin(i * 1.3) * 0.06,
        Math.cos(i * 1.7) * 0.06,
        0.62,
        -0.9 + i * 0.2,
        -0.75 + i * 0.2,
        d,
      );
    for (let i = 0; i < 4; i++)
      cylinder(pts, 0.95 + Math.sin(i) * 0.05, 0.1, 0.45, -0.9 + i * 0.18, -0.77 + i * 0.18, d);
  } else if (m === "scale") {
    cylinder(pts, 0, 0, 0.05, -0.9, 0.7, d, false);
    box(pts, 0, -0.95, 0, 0.9, 0.08, 0.5, d);
    box(pts, 0, 0.72, 0, 2.2, 0.06, 0.08, d);
    for (const s of [-1, 1]) {
      tube(
        pts,
        [
          [s * 1.05, 0.7, 0],
          [s * 1.05, 0.1, 0],
        ],
        0.02,
        d,
      );
      cylinder(pts, s * 1.05, 0, 0.42, 0.02, 0.08, d);
    }
  } else {
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) {
          if ((i + j + k) % 2 !== 0) continue;
          box(pts, i * 0.7, j * 0.7, k * 0.7, 0.42, 0.42, 0.42, d);
        }
  }
  cache.set(key, pts);
  return pts;
}
