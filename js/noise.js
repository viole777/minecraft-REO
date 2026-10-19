/* Mundo de Blocos - núcleo de ruído determinístico (implementação original) */
;((g) => {
const VX = g.VX = g.VX || {};

VX.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

VX.hash2 = function (x, z, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (z | 0), 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

VX.hash3 = function (x, y, z, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }

function grad2(h, x, y) {
  switch (h & 3) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    default: return -x - y;
  }
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
];
function grad3(h, x, y, z) {
  const g = GRAD3[h % 12];
  return g[0] * x + g[1] * y + g[2] * z;
}

function shufflePerm(seed) {
  const rand = VX.mulberry32(seed);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  return p;
}

VX.Noise2D = function (seed) {
  const p = shufflePerm(seed);
  return {
    perlin(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const X = xi & 255, Y = yi & 255;
      const xf = x - xi, yf = y - yi;
      const u = fade(xf), v = fade(yf);
      const aa = p[p[X] + Y], ab = p[p[X] + Y + 1];
      const ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
      const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
      const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
      return lerp(x1, x2, v) * 0.7071; // normaliza para ~[-1,1]
    }
  };
};

VX.Noise3D = function (seed) {
  const p = shufflePerm(seed);
  return {
    perlin(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const X = xi & 255, Y = yi & 255, Z = zi & 255;
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = fade(xf), v = fade(yf), w = fade(zf);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
      const Bb = p[X + 1] + Y, BA = p[Bb] + Z, BB = p[Bb + 1] + Z;
      const g = (h, ox, oy, oz) => grad3(p[h], ox, oy, oz);
      const x1 = lerp(g(p[AA], xf, yf, zf), g(p[BA], xf - 1, yf, zf), u);
      const x2 = lerp(g(p[AB], xf, yf - 1, zf), g(p[BB], xf - 1, yf - 1, zf), u);
      const y1 = lerp(x1, x2, v);
      const x3 = lerp(g(p[AA + 1], xf, yf, zf - 1), g(p[BA + 1], xf - 1, yf, zf - 1), u);
      const x4 = lerp(g(p[AB + 1], xf, yf - 1, zf - 1), g(p[BB + 1], xf - 1, yf - 1, zf - 1), u);
      const y2 = lerp(x3, x4, v);
      return lerp(y1, y2, w);
    }
  };
};

VX.fbm2 = function (noise, x, y, octaves, lac, gain) {
  lac = lac || 2; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise.perlin(x * freq, y * freq);
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
};

VX.fbm3 = function (noise, x, y, z, octaves, lac, gain) {
  lac = lac || 2; gain = gain || 0.5;
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise.perlin(x * freq, y * freq, z * freq);
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
};

})(typeof window !== 'undefined' ? window : globalThis);
