/* Mundo de Blocos - mundo voxel em chunks (geração original) */
;((g) => {
const VX = g.VX = g.VX || {};
const CH = VX.CHUNK_SIZE = 16;
const H = VX.WORLD_HEIGHT = 80;
const WL = VX.WATER_LEVEL = 33;

function ci(x, y, z) { return x + z * CH + y * CH * CH; }

VX.World = class {
  constructor(seed, edits) {
    this.seed = seed | 0;
    this.noise = new VX.Noise2D(this.seed);
    this.chunks = new Map();   // "cx,cz" -> Uint8Array
    this.dirty = new Set();    // chunks que precisam remesh
    this.edits = edits || new Map();  // "x,y,z" -> id (persistência)
  }

  columnHeight(x, z) {
    const n1 = VX.fbm2(this.noise, x * 0.006, z * 0.006, 4);
    const n2 = VX.fbm2(this.noise, x * 0.031 + 100, z * 0.031 - 40, 3);
    let h = 36 + n1 * 9 + n2 * 2.5;
    return Math.max(8, Math.min(H - 12, Math.round(h)));
  }

  genChunk(cx, cz) {
    const B = VX.Blocks;
    const data = new Uint8Array(CH * CH * H);
    const heights = new Int16Array(CH * CH);

    for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
      const wx = cx * CH + lx, wz = cz * CH + lz;
      const h = this.columnHeight(wx, wz);
      heights[lx + lz * CH] = h;
      const shore = h < WL + 1;
      data[ci(lx, 0, lz)] = B.BEDROCK;
      for (let y = 1; y <= h; y++) {
        let id;
        if (y === h) id = shore ? B.SAND : (h >= 46 ? B.SNOW : B.GRASS);
        else if (y > h - 4) id = shore ? B.SAND : B.DIRT;
        else id = B.STONE;
        data[ci(lx, y, lz)] = id;
      }
      for (let y = h + 1; y <= WL; y++) data[ci(lx, y, lz)] = B.WATER;
    }

    // veios de minério (carvão/ferro) em células 4x4x4
    const rnd = VX.mulberry32(VX.hash2(cx, cz, this.seed ^ 0x5f3a));
    for (let cxx = 0; cxx < CH; cxx += 4) for (let czz = 0; czz < CH; czz += 4) for (let cy = 4; cy < H; cy += 4) {
      if (rnd() >= 0.16) continue;
      const type = rnd() < 0.65 ? B.COAL_ORE : B.IRON_ORE;
      const ox = cxx + ((rnd() * 4) | 0), oy = cy + ((rnd() * 4) | 0), oz = czz + ((rnd() * 4) | 0);
      const r = 1.2 + rnd() * 0.9;
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        const x = ox + dx, y = oy + dy, z = oz + dz;
        if (x < 0 || x >= CH || z < 0 || z >= CH || y < 1 || y >= H) continue;
        if (data[ci(x, y, z)] === B.STONE) data[ci(x, y, z)] = type;
      }
    }

    // árvores (margem 2 para a copa caber no chunk)
    const trees = [];
    for (let lx = 2; lx <= 13; lx++) for (let lz = 2; lz <= 13; lz++) {
      const h = heights[lx + lz * CH];
      if (h < WL + 1 || h >= 46) continue;
      if (VX.hash2(cx * CH + lx, cz * CH + lz, this.seed ^ 0x9e37) > 0.012) continue;
      let ok = true;
      for (const t of trees) if (Math.abs(t.x - lx) < 5 && Math.abs(t.z - lz) < 5) { ok = false; break; }
      if (ok) trees.push({ x: lx, z: lz, h: h });
    }
    for (const t of trees) this._tree(data, t.x, t.z, t.h, rnd);

    // vegetação (grama alta e flores)
    for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
      const h = heights[lx + lz * CH];
      if (data[ci(lx, h, lz)] !== B.GRASS || data[ci(lx, h + 1, lz)] !== 0) continue;
      const wx = cx * CH + lx, wz = cz * CH + lz;
      const r = VX.hash2(wx * 3, wz * 7, this.seed ^ 0x1234);
      if (r < 0.10) data[ci(lx, h + 1, lz)] = B.TALLGRASS;
      else if (r < 0.118) data[ci(lx, h + 1, lz)] = VX.hash2(wx, wz, this.seed ^ 0x77) < 0.5 ? B.POPPY : B.DANDELION;
    }

    // aplica edições salvas neste chunk
    for (const e of this.edits) {
      const p = e[0].split(',');
      const x = +p[0] - cx * CH, y = +p[1], z = +p[2] - cz * CH;
      if (x >= 0 && x < CH && z >= 0 && z < CH && y >= 0 && y < H) data[ci(x, y, z)] = e[1];
    }

    return data;
  }

  _tree(data, x, z, h, rnd) {
    const B = VX.Blocks;
    const th = 4 + ((rnd() * 2) | 0);
    const top = h + th;
    for (let dy = -2; dy <= 1; dy++) {
      const ly = top + dy;
      const rad = dy <= -1 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && rnd() < 0.5) continue;
        const px = x + dx, pz = z + dz;
        if (px < 0 || px > 15 || pz < 0 || pz > 15 || ly < 0 || ly >= H) continue;
        const i = ci(px, ly, pz);
        if (data[i] === 0 || data[i] === B.LEAVES) data[i] = B.LEAVES;
      }
    }
    for (let y = h + 1; y <= top; y++) data[ci(x, y, z)] = B.LOG;
  }

  getChunk(cx, cz) {
    const k = cx + ',' + cz;
    let c = this.chunks.get(k);
    if (!c) { c = this.genChunk(cx, cz); this.chunks.set(k, c); }
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0) return VX.Blocks.BEDROCK;   // chão indestrutível infinito
    if (y >= H) return 0;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const c = this.getChunk(cx, cz);
    return c[x - cx * CH + (z - cz * CH) * CH + y * CH * CH];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const lx = x - cx * CH, lz = z - cz * CH;
    const c = this.getChunk(cx, cz);
    const i = ci(lx, y, lz);
    if (c[i] === id) return false;
    c[i] = id;
    this.edits.set(x + ',' + y + ',' + z, id);
    this.dirty.add(cx + ',' + cz);
    if (lx === 0) this.dirty.add((cx - 1) + ',' + cz);
    if (lx === CH - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (lz === 0) this.dirty.add(cx + ',' + (cz - 1));
    if (lz === CH - 1) this.dirty.add(cx + ',' + (cz + 1));
    return true;
  }

  /* y do primeiro bloco sólido visto de cima (para spawn/mobs); -1 se none */
  surfaceY(x, z) {
    for (let y = H - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (VX.isSolid(id)) return y;
    }
    return -1;
  }
};

/* __END__ */
})(typeof window !== 'undefined' ? window : globalThis);
