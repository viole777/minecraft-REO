/* Mundo de Blocos - geração de malha por chunk (occlusão de faces + AO + sombreamento por face) */
;((g) => {
const VX = g.VX = g.VX || {};
const CH = VX.CHUNK_SIZE = 16;
const H = VX.WORLD_HEIGHT = 80;

/* Faces do cubo: direção, sombreamento e 4 cantos CCW (visto de fora) com UV 0..1 */
const FACES = [
  { dir: [0, 1, 0], shade: 1.0, corners: [
    { pos: [0, 1, 0], uv: [0, 0] }, { pos: [0, 1, 1], uv: [0, 1] },
    { pos: [1, 1, 1], uv: [1, 1] }, { pos: [1, 1, 0], uv: [1, 0] } ] },
  { dir: [0, -1, 0], shade: 0.5, corners: [
    { pos: [0, 0, 0], uv: [0, 0] }, { pos: [1, 0, 0], uv: [1, 0] },
    { pos: [1, 0, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [0, 1] } ] },
  { dir: [0, 0, 1], shade: 0.8, corners: [
    { pos: [0, 0, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [1, 1] },
    { pos: [1, 1, 1], uv: [1, 0] }, { pos: [0, 1, 1], uv: [0, 0] } ] },
  { dir: [0, 0, -1], shade: 0.8, corners: [
    { pos: [1, 0, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [1, 1] },
    { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] } ] },
  { dir: [1, 0, 0], shade: 0.6, corners: [
    { pos: [1, 0, 0], uv: [1, 1] }, { pos: [1, 1, 0], uv: [1, 0] },
    { pos: [1, 1, 1], uv: [0, 0] }, { pos: [1, 0, 1], uv: [0, 1] } ] },
  { dir: [-1, 0, 0], shade: 0.6, corners: [
    { pos: [0, 0, 0], uv: [0, 1] }, { pos: [0, 0, 1], uv: [1, 1] },
    { pos: [0, 1, 1], uv: [1, 0] }, { pos: [0, 1, 0], uv: [0, 0] } ] }
];
VX.FACES = FACES;

const AO_MUL = [0.45, 0.62, 0.80, 1.0];

function buf() { return { pos: [], uv: [], col: [], idx: [] }; }

function quad(b, verts, uvs, cols) {
  const base = b.pos.length / 3;
  for (let i = 0; i < 4; i++) {
    b.pos.push(verts[i][0], verts[i][1], verts[i][2]);
    b.uv.push(uvs[i][0], uvs[i][1]);
    b.col.push(cols[i][0], cols[i][1], cols[i][2]);
  }
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function tangents(dir) {
  const t = [];
  for (let a = 0; a < 3; a++) if (dir[a] === 0) t.push(a);
  return t;
}

VX.buildChunkGeometry = function (world, cx, cz) {
  const B = VX.Blocks;
  const solid = buf(), cross = buf(), water = buf();
  const ox = cx * CH, oz = cz * CH;
  const get = (x, y, z) => world.getBlock(ox + x, y, oz + z);

  for (let y = 0; y < H; y++) for (let lz = 0; lz < CH; lz++) for (let lx = 0; lx < CH; lx++) {
    const id = get(lx, y, lz);
    if (!id) continue;
    const d = VX.blockDef(id);

    /* --- blocos em cruz (grama alta, flores) --- */
    if (d.cross) {
      const r = VX.Tex.uvRect(d.tiles.side);
      const tint = 0.92 + VX.hash2(ox + lx, oz + lz, 7) * 0.16;
      const c0 = [tint, tint, tint];
      const uvs = [[r.u0, r.v1], [r.u1, r.v1], [r.u1, r.v0], [r.u0, r.v0]];
      quad(cross, [
        [lx + 0.146, y, lz + 0.146], [lx + 0.854, y, lz + 0.854],
        [lx + 0.854, y + 1, lz + 0.854], [lx + 0.146, y + 1, lz + 0.146]
      ], uvs, [c0, c0, c0, c0]);
      quad(cross, [
        [lx + 0.854, y, lz + 0.146], [lx + 0.146, y, lz + 0.854],
        [lx + 0.146, y + 1, lz + 0.854], [lx + 0.854, y + 1, lz + 0.146]
      ], uvs, [c0, c0, c0, c0]);
      continue;
    }

    /* --- água --- */
    if (d.liquid) {
      const above = get(lx, y + 1, lz);
      const hTop = above === B.WATER ? 1.0 : 0.88;
      const rw = VX.Tex.uvRect('water');
      for (const f of FACES) {
        const n = get(lx + f.dir[0], y + f.dir[1], lz + f.dir[2]);
        if (f.dir[1] === 1) { if (n === B.WATER || VX.isOpaque(n)) continue; }
        else if (f.dir[1] === -1) { if (n !== 0 && n !== B.WATER) continue; }
        else { if (n !== 0) continue; }
        const verts = [], uvs = [], cols = [];
        for (const c of f.corners) {
          const yy = c.pos[1] === 1 ? y + hTop : y;
          verts.push([lx + c.pos[0], yy, lz + c.pos[2]]);
          uvs.push([rw.u0 + c.uv[0] * (rw.u1 - rw.u0), rw.v0 + c.uv[1] * (rw.v1 - rw.v0)]);
          cols.push([f.shade, f.shade, f.shade]);
        }
        quad(water, verts, uvs, cols);
      }
      continue;
    }

    /* --- blocos sólidos --- */
    for (const f of FACES) {
      const nx = lx + f.dir[0], ny = y + f.dir[1], nz = lz + f.dir[2];
      let n;
      if (ny < 0) n = B.BEDROCK;           // base do mundo oclui o fundo
      else if (ny >= H) n = 0;
      else n = get(nx, ny, nz);
      if (n !== 0 && (VX.isOpaque(n) || n === id)) continue;

      const tileName = f.dir[1] === 1 ? d.tiles.top : (f.dir[1] === -1 ? d.tiles.bottom : d.tiles.side);
      const r = VX.Tex.uvRect(tileName);
      const ta = tangents(f.dir);
      const verts = [], uvs = [], cols = [];
      for (const c of f.corners) {
        verts.push([lx + c.pos[0], y + c.pos[1], lz + c.pos[2]]);
        uvs.push([r.u0 + c.uv[0] * (r.u1 - r.u0), r.v0 + c.uv[1] * (r.v1 - r.v0)]);
        // oclusão ambiente: 3 vizinhos ao redor do canto, no plano da face
        const s1 = c.pos[ta[0]] ? 1 : -1;
        const s2 = c.pos[ta[1]] ? 1 : -1;
        const nb = (a1, a2) => {
          const p = [nx, ny, nz];
          if (a1) p[ta[0]] += s1;
          if (a2) p[ta[1]] += s2;
          return VX.isOpaque(get(p[0], p[1], p[2])) ? 1 : 0;
        };
        const b1 = nb(1, 0), b2 = nb(0, 1), bc = nb(1, 1);
        const ao = (b1 && b2) ? 0 : 3 - (b1 + b2 + bc);
        const sh = f.shade * AO_MUL[ao];
        cols.push([sh, sh, sh]);
      }
      quad(solid, verts, uvs, cols);
    }
  }

  return { solid: solid, cross: cross, water: water };
};

})(typeof window !== 'undefined' ? window : globalThis);
