/* Mundo de Blocos - atlas de texturas 16x16, 100% gerado por código (pixel art procedural original) */
;((g) => {
const VX = g.VX = g.VX || {};
const TS = 16, COLS = 8, ROWS = 8;
const slots = {};      // nome -> índice no atlas
const tileCanv = {};   // nome -> canvas 16x16
const icons = {};      // id -> dataURL do ícone
const avg = {};        // nome -> cor média [r,g,b] 0..1
let atlas = null, atlasCtx = null, tex = null, armUrl = null;
let slotCount = 0;

function speckle(ctx, rnd, palette) {
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    ctx.fillStyle = palette[(rnd() * palette.length) | 0];
    ctx.fillRect(x, y, 1, 1);
  }
}

function makeTile(name, draw) {
  const c = document.createElement('canvas');
  c.width = TS; c.height = TS;
  const ctx = c.getContext('2d');
  const rnd = VX.mulberry32(VX.hash2(slotCount, 7, 0xabc));
  draw(ctx, rnd);
  const slot = slotCount++;
  slots[name] = slot; tileCanv[name] = c;
  atlasCtx.drawImage(c, (slot % COLS) * TS, ((slot / COLS) | 0) * TS);
}

const STONE_COLS = ['#7d7d7d', '#757575', '#868686', '#6e6e6e', '#7a7a7a'];
const DIRT_COLS = ['#8a5a3c', '#7d5135', '#96684a', '#6f452c', '#835437'];
const GRASS_COLS = ['#6aa84f', '#5f9c46', '#77b358', '#548f3d', '#6aa84f'];
const SAND_COLS = ['#e0d6a8', '#d8cc9b', '#e8dfb5', '#cfc38f', '#ddd2a0'];

function buildTiles() {
  makeTile('dirt', (c, r) => speckle(c, r, DIRT_COLS));

  makeTile('grass_top', (c, r) => speckle(c, r, GRASS_COLS));

  makeTile('grass_side', (c, r) => {
    speckle(c, r, DIRT_COLS);
    for (let x = 0; x < TS; x++) {
      const d = 3 + ((r() * 3) | 0);
      for (let y = 0; y < d; y++) { c.fillStyle = GRASS_COLS[(r() * GRASS_COLS.length) | 0]; c.fillRect(x, y, 1, 1); }
    }
  });

  makeTile('stone', (c, r) => speckle(c, r, STONE_COLS));

  makeTile('cobble', (c, r) => {
    c.fillStyle = '#4f4f4f'; c.fillRect(0, 0, TS, TS);
    const grays = ['#8d8d8d', '#7f7f7f', '#9a9a9a', '#737373'];
    const blobs = [[1, 1, 6, 5], [8, 0, 7, 5], [0, 7, 6, 4], [8, 7, 8, 6], [2, 12, 5, 4], [10, 14, 6, 2]];
    for (const b of blobs) {
      const x = b[0], y = b[1], w = b[2], h = b[3];
      c.fillStyle = grays[(r() * grays.length) | 0];
      c.fillRect(x + 1, y + 1, w - 2, h - 2);
      c.fillStyle = '#a8a8a8'; c.fillRect(x + 1, y + 1, w - 2, 1);
      c.fillStyle = '#565656';
      c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1);
      c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
    }
    for (let i = 0; i < 20; i++) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect((r() * TS) | 0, (r() * TS) | 0, 1, 1); }
  });

  makeTile('sand', (c, r) => speckle(c, r, SAND_COLS));
  makeTile('gravel', (c, r) => speckle(c, r, ['#8a8177', '#9c948a', '#7a7268', '#a9a199', '#6f675e']));

  makeTile('log_side', (c, r) => {
    const cols = ['#6b4f2e', '#5f4526', '#7a5c38', '#553d20'];
    for (let x = 0; x < TS; x++) {
      const base = cols[(r() * cols.length) | 0];
      for (let y = 0; y < TS; y++) { c.fillStyle = r() < 0.18 ? cols[(r() * cols.length) | 0] : base; c.fillRect(x, y, 1, 1); }
    }
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 3; i++) c.fillRect((r() * TS) | 0, 0, 1, TS);
  });

  makeTile('log_top', (c, r) => {
    speckle(c, r, ['#a5824f', '#9c7a48', '#ad8b57']);
    const rings = ['#8a6b3e', '#a5824f', '#7a5c33', '#96743f'];
    c.lineWidth = 1;
    for (let ring = 0; ring < 4; ring++) {
      c.strokeStyle = rings[ring];
      c.strokeRect(1.5 + ring * 1.7, 1.5 + ring * 1.7, TS - 3 - ring * 3.4, TS - 3 - ring * 3.4);
    }
    c.fillStyle = '#5f4526'; c.fillRect(7, 7, 2, 2);
  });

  makeTile('planks', (c, r) => {
    const cols = ['#b08c56', '#a6834e', '#ba955f', '#9c7a48'];
    for (let band = 0; band < 4; band++) {
      c.fillStyle = cols[(r() * cols.length) | 0];
      c.fillRect(0, band * 4, TS, 4);
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, band * 4 + 3, TS, 1);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 3; i++) c.fillRect((r() * TS) | 0, band * 4 + ((r() * 3) | 0), 2 + ((r() * 3) | 0), 1);
      const sx = (band % 2 ? 4 : 10) + ((r() * 5) | 0);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(sx, band * 4, 1, 3);
    }
  });

  makeTile('leaves', (c, r) => {
    const cols = ['#3e6b2e', '#356028', '#4a7a38', '#2e5423'];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      if (r() < 0.14) continue; // furos (alpha 0)
      c.fillStyle = cols[(r() * cols.length) | 0];
      c.fillRect(x, y, 1, 1);
    }
  });

  makeTile('bricks', (c, r) => {
    c.fillStyle = '#9e9a92'; c.fillRect(0, 0, TS, TS);
    const reds = ['#a4523c', '#96482f', '#b05c45', '#8c4231'];
    for (let row = 0; row < 4; row++) {
      const y = row * 4, off = (row % 2) * 4;
      for (let bx = -1; bx < 3; bx++) {
        const x = off + bx * 8;
        const x0 = Math.max(0, x), x1 = Math.min(TS, x + 7);
        if (x1 > x0) {
          c.fillStyle = reds[(r() * reds.length) | 0];
          c.fillRect(x0, y, x1 - x0, 3);
          c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x0, y, x1 - x0, 1);
        }
      }
    }
  });

  makeTile('snow', (c, r) => speckle(c, r, ['#f7fbfd', '#eef5f8', '#ffffff', '#e7eff3']));

  makeTile('snow_side', (c, r) => {
    speckle(c, r, DIRT_COLS);
    for (let x = 0; x < TS; x++) {
      const d = 4 + ((r() * 2) | 0);
      for (let y = 0; y < d; y++) { c.fillStyle = ['#f7fbfd', '#eef5f8', '#ffffff'][(r() * 3) | 0]; c.fillRect(x, y, 1, 1); }
    }
  });

  makeTile('glass', (c, r) => {
    c.fillStyle = 'rgba(205,236,246,0.30)'; c.fillRect(0, 0, TS, TS);
    c.fillStyle = '#dff3f8';
    c.fillRect(0, 0, TS, 1); c.fillRect(0, TS - 1, TS, 1); c.fillRect(0, 0, 1, TS); c.fillRect(TS - 1, 0, 1, TS);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 6; i++) c.fillRect(3 + i, 11 - i, 1, 1);
    c.fillRect(10, 3, 1, 1); c.fillRect(4, 13, 1, 1);
  });

  makeTile('water', (c, r) => {
    const cols = ['#3a6be0', '#3362d2', '#4477ee', '#2f5cc4'];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const wave = Math.sin((x + y * 0.7) * 0.9) > 0.3 ? 1 : 0;
      c.fillStyle = cols[(wave + ((r() * 2) | 0)) % cols.length];
      c.fillRect(x, y, 1, 1);
    }
  });

  makeTile('coal_ore', (c, r) => {
    speckle(c, r, STONE_COLS);
    for (let i = 0; i < 4; i++) {
      const x = (r() * 13) | 0, y = (r() * 13) | 0;
      c.fillStyle = ['#262626', '#333333'][(r() * 2) | 0];
      c.fillRect(x, y, 2, 2);
      c.fillStyle = '#181818'; c.fillRect(x + 1, y + 1, 1, 1);
    }
  });

  makeTile('iron_ore', (c, r) => {
    speckle(c, r, STONE_COLS);
    for (let i = 0; i < 4; i++) {
      const x = (r() * 13) | 0, y = (r() * 13) | 0;
      c.fillStyle = ['#d8a583', '#c68e6b'][(r() * 2) | 0];
      c.fillRect(x, y, 2, 2);
      c.fillStyle = '#e8bfa4'; c.fillRect(x, y, 1, 1);
    }
  });

  makeTile('bedrock', (c, r) => speckle(c, r, ['#3a3a3a', '#4a4a4a', '#2b2b2b', '#585858', '#222222']));

  makeTile('tallgrass', (c, r) => {
    const g = ['#4a7a38', '#3e6b2e', '#5f9c46', '#548f3d'];
    for (let i = 0; i < 8; i++) {
      const x = 1 + ((r() * (TS - 2)) | 0);
      const h = 6 + ((r() * 8) | 0);
      for (let y = 0; y < h; y++) {
        const wob = (y > h * 0.55 && r() < 0.4) ? 1 : 0;
        c.fillStyle = g[(r() * g.length) | 0];
        c.fillRect(x + wob, TS - 1 - y, 1, 1);
      }
    }
  });

  makeTile('poppy', (c, r) => {
    c.fillStyle = '#3e6b2e';
    for (let y = 7; y < TS; y++) c.fillRect(7 + (y > 11 ? 1 : 0), y, 1, 1);
    c.fillRect(5, 11, 2, 1); c.fillRect(9, 10, 2, 1);
    const reds = ['#c0342b', '#d64539', '#a82a22'];
    for (let y = 1; y < 7; y++) for (let x = 4; x < 12; x++) {
      const dx = x - 7.5, dy = y - 3.5;
      if (dx * dx / 9 + dy * dy / 4 <= 1.2) { c.fillStyle = reds[(r() * reds.length) | 0]; c.fillRect(x, y, 1, 1); }
    }
    c.fillStyle = '#2b1a12'; c.fillRect(7, 3, 2, 2);
  });

  makeTile('dandelion', (c, r) => {
    c.fillStyle = '#3e6b2e';
    for (let y = 8; y < TS; y++) c.fillRect(7 + (y > 12 ? 1 : 0), y, 1, 1);
    c.fillRect(5, 12, 2, 1); c.fillRect(9, 11, 2, 1);
    const yell = ['#f0c832', '#e3ba25', '#ffe066'];
    for (let y = 2; y < 7; y++) for (let x = 5; x < 11; x++) {
      if (Math.abs(x - 7.5) < 2.6 && y < 6) { c.fillStyle = yell[(r() * yell.length) | 0]; c.fillRect(x, y, 1, 1); }
    }
    c.fillStyle = '#8a6b1e'; c.fillRect(7, 5, 2, 1);
  });

  makeTile('sandstone', (c, r) => {
    speckle(c, r, ['#dfd3a3', '#e6dba9', '#d5c894']);
    c.fillStyle = 'rgba(0,0,0,0.10)';
    c.fillRect(0, 3, TS, 1); c.fillRect(0, 7, TS, 1); c.fillRect(0, 11, TS, 1);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, TS, 1);
  });
  makeTile('sandstone_top', (c, r) => speckle(c, r, ['#e6dba9', '#dfd3a3', '#eee2b6']));

  makeTile('stone_brick', (c, r) => {
    c.fillStyle = '#4f4f4f'; c.fillRect(0, 0, TS, TS);
    const grays = ['#7d7d7d', '#757575', '#868686'];
    for (let row = 0; row < 4; row++) {
      const y = row * 4, off = (row % 2) * 4;
      for (let bx = -1; bx < 3; bx++) {
        const x = off + bx * 8;
        const x0 = Math.max(0, x), x1 = Math.min(TS, x + 7);
        if (x1 > x0) {
          c.fillStyle = grays[(r() * grays.length) | 0];
          c.fillRect(x0, y, x1 - x0, 3);
          c.fillStyle = 'rgba(255,255,255,0.10)'; c.fillRect(x0, y, x1 - x0, 1);
        }
      }
    }
  });

  makeTile('obsidian', (c, r) => {
    speckle(c, r, ['#1b1226', '#221633', '#2a1c3d', '#150d1e']);
    for (let i = 0; i < 6; i++) { c.fillStyle = '#4a3470'; c.fillRect((r() * TS) | 0, (r() * TS) | 0, 1, 1); }
  });
}

VX.Tex = {
  init() {
    if (tex) return tex;
    atlas = document.createElement('canvas');
    atlas.width = COLS * TS; atlas.height = ROWS * TS;
    atlasCtx = atlas.getContext('2d');
    atlasCtx.clearRect(0, 0, atlas.width, atlas.height);
    buildTiles();
    tex = new THREE.CanvasTexture(atlas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.flipY = false;          // v cresce para baixo, como o canvas
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  },

  uvRect(name) {
    this.init();
    const s = slots[name] || 0;
    const col = s % COLS, row = (s / COLS) | 0;
    const e = 0.0008;           // inset anti-bleeding
    return { u0: col / COLS + e, v0: row / ROWS + e, u1: (col + 1) / COLS - e, v1: (row + 1) / ROWS - e };
  },

  /* Ícone isométrico de cubo para hotbar/inventário */
  iconDataURL(id) {
    this.init();
    if (icons[id]) return icons[id];
    const d = VX.blockDef(id);
    const S = 48;
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const face = (pts, ox, oy, ax, ay, bx, by, tile, shade) => {
      c.save();
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath(); c.clip();
      c.setTransform(ax / TS, ay / TS, bx / TS, by / TS, ox, oy);
      c.drawImage(tile, 0, 0);
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (shade > 0) { c.fillStyle = 'rgba(0,0,0,' + shade + ')'; c.fillRect(0, 0, S, S); }
      c.restore();
    };
    if (d.cross) {
      c.drawImage(tileCanv[d.tiles.side], 4, 4, 40, 40);
    } else {
      const top = tileCanv[d.tiles.top], side = tileCanv[d.tiles.side];
      face([[24, 2], [44, 12], [24, 22], [4, 12]], 24, 2, 20, 10, -20, 10, top, 0);
      face([[4, 12], [24, 22], [24, 44], [4, 34]], 4, 12, 20, 10, 0, 22, side, 0.30);
      face([[24, 22], [44, 12], [44, 34], [24, 44]], 24, 22, 20, -10, 0, 22, side, 0.12);
    }
    icons[id] = cv.toDataURL();
    return icons[id];
  },

  /* Antebraço pixelado para o HUD */
  armDataURL() {
    this.init();
    if (armUrl) return armUrl;
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
    const c = cv.getContext('2d');
    c.save();
    c.translate(48, 48); c.rotate(-0.5); c.translate(-48, -48);
    c.fillStyle = '#c98a5e'; c.fillRect(34, 4, 28, 96);
    c.fillStyle = '#b5764c'; c.fillRect(34, 4, 6, 96);
    c.fillStyle = '#daa075'; c.fillRect(56, 4, 6, 96);
    c.fillStyle = '#a96a42'; c.fillRect(34, 4, 28, 4);
    const rnd = VX.mulberry32(1234);
    c.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 40; i++) c.fillRect(36 + ((rnd() * 24) | 0), 8 + ((rnd() * 88) | 0), 2, 1);
    c.restore();
    armUrl = cv.toDataURL();
    return armUrl;
  },

  /* Cor média de um tile (para partículas) */
  avgColor(name) {
    this.init();
    if (avg[name]) return avg[name];
    const cc = tileCanv[name];
    const d = cc.getContext('2d').getImageData(0, 0, TS, TS).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (!n) { r = gg = b = 120; n = 1; }
    avg[name] = [r / n / 255, gg / n / 255, b / n / 255];
    return avg[name];
  }
};

})(typeof window !== 'undefined' ? window : globalThis);



