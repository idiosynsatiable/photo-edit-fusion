import type { Transform, Vec2 } from '@pef/shared';

/** Build a 3x3 affine matrix in column-major order from a Transform. */
export function transformToMatrix(t: Transform, width: number, height: number): Float32Array {
  const cx = width * t.anchor.x;
  const cy = height * t.anchor.y;
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const sx = t.scale.x;
  const sy = t.scale.y;

  // T(pos) * T(anchor) * R * S * T(-anchor)
  const a = c * sx;
  const b = s * sx;
  const d = -s * sy;
  const e = c * sy;
  const tx = t.position.x + cx - a * cx - d * cy;
  const ty = t.position.y + cy - b * cx - e * cy;

  // column-major 3x3
  return new Float32Array([a, b, 0, d, e, 0, tx, ty, 1]);
}

export function applyMatrix(m: Float32Array, p: Vec2): Vec2 {
  return {
    x: m[0]! * p.x + m[3]! * p.y + m[6]!,
    y: m[1]! * p.x + m[4]! * p.y + m[7]!,
  };
}

export function invertMatrix(m: Float32Array): Float32Array {
  const a = m[0]!,
    b = m[1]!,
    d = m[3]!,
    e = m[4]!,
    tx = m[6]!,
    ty = m[7]!;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-12) {
    // singular — return identity to avoid throwing in render hot paths
    return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  }
  const inv = 1 / det;
  const A = e * inv;
  const B = -b * inv;
  const D = -d * inv;
  const E = a * inv;
  const TX = -(A * tx + D * ty);
  const TY = -(B * tx + E * ty);
  return new Float32Array([A, B, 0, D, E, 0, TX, TY, 1]);
}

export function identityTransform(): Transform {
  return {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
  };
}
