/* Mundo de Blocos - animais (ovelha-like original) com IA de vagueio */
;((g) => {
const VX = g.VX = g.VX || {};

function boxMesh(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: color })
  );
  return m;
}

function buildSheep() {
  const root = new THREE.Group();
  const wool = 0xf4f4f0, skin = 0xd9d5cd, dark = 0x222222;

  const body = boxMesh(0.72, 0.62, 1.05, wool);
  body.position.y = 0.85;
  root.add(body);

  const head = boxMesh(0.42, 0.42, 0.42, skin);
  head.position.set(0, 1.05, -0.72);
  root.add(head);

  const snout = boxMesh(0.22, 0.18, 0.06, 0xc4bfb6);
  snout.position.set(0, 0.98, -0.95);
  root.add(snout);

  const eyeGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);
  const eyeMat = new THREE.MeshBasicMaterial({ color: dark });
  for (const sx of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx, 1.1, -0.94);
    root.add(eye);
  }

  const legs = [];
  const legGeo = new THREE.BoxGeometry(0.17, 0.52, 0.17);
  const legMat = new THREE.MeshLambertMaterial({ color: skin });
  const lp = [[-0.22, -0.32], [0.22, -0.32], [-0.22, 0.34], [0.22, 0.34]];
  for (const p of lp) {
    const leg = new THREE.Mesh(legGeo, legMat);
    const pivot = new THREE.Group();
    pivot.position.set(p[0], 0.52, p[1]);
    leg.position.y = -0.26;
    pivot.add(leg);
    root.add(pivot);
    legs.push(pivot);
  }
  root.userData.legs = legs;
  root.userData.head = head;
  return root;
}

VX.Mobs = class {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.list = [];
    this.rand = VX.mulberry32((world.seed ^ 0x51ee) | 0);
  }

  clear() {
    for (const m of this.list) {
      this.scene.remove(m.mesh);
      m.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.list = [];
  }

  spawnInitial(px, pz) {
    this.clear();
    for (let i = 0; i < 8; i++) this._spawnNear(px, pz, 10 + i * 4);
  }

  _spawnNear(px, pz, radius) {
    const r = this.rand;
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2;
      const x = Math.floor(px + Math.sin(a) * (radius * (0.4 + r() * 0.6)));
      const z = Math.floor(pz + Math.cos(a) * (radius * (0.4 + r() * 0.6)));
      const y = this.world.surfaceY(x, z);
      if (y < 0 || y >= VX.WORLD_HEIGHT - 3) continue;
      if (this.world.getBlock(x, y, z) !== VX.Blocks.GRASS) continue;
      if (!VX.isLiquid(this.world.getBlock(x, y + 1, z))) continue;
      const mesh = buildSheep();
      mesh.position.set(x + 0.5, y + 1, z + 0.5);
      mesh.rotation.y = r() * Math.PI * 2;
      this.scene.add(mesh);
      this.list.push({
        mesh: mesh,
        pos: { x: x + 0.5, y: y + 1, z: z + 0.5 },
        yaw: r() * Math.PI * 2,
        vy: 0, timer: r() * 4, moving: false,
        walk: 0, legs: mesh.userData.legs, head: mesh.userData.head
      });
      return true;
    }
    return false;
  }

  update(dt, playerPos) {
    const w = this.world;
    const r = this.rand;
    for (const m of this.list) {
      const dx = m.pos.x - playerPos.x, dz = m.pos.z - playerPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 90) { // reposiciona longe demais
        this.scene.remove(m.mesh);
        this.list.splice(this.list.indexOf(m), 1);
        this._spawnNear(playerPos.x, playerPos.z, 24);
        continue;
      }

      m.timer -= dt;
      if (m.timer <= 0) {
        m.timer = 3 + r() * 5;
        m.moving = r() < 0.75;
        if (m.moving) m.yaw = r() * Math.PI * 2;
      }

      let speed = 0;
      if (m.moving) {
        const dx2 = Math.sin(m.yaw) * 1.4 * dt, dz2 = Math.cos(m.yaw) * 1.4 * dt;
        const nx = m.pos.x + dx2, nz = m.pos.z + dz2;
        const fy = Math.floor(m.pos.y + 0.1);
        const bx = Math.floor(nx), bz = Math.floor(nz);
        const blockedLow = VX.isSolid(w.getBlock(bx, fy + 1, bz));
        const blockedHigh = VX.isSolid(w.getBlock(bx, fy + 2, bz));
        if (blockedLow || blockedHigh) {
          if (blockedLow && !blockedHigh && m.vy <= 0.01) m.vy = 7.2; // pula degrau 1
          else { m.moving = false; m.timer = 1 + r() * 3; }
        } else {
          m.pos.x = nx; m.pos.z = nz;
          speed = 1.4;
        }
      }

      m.vy -= 25 * dt;
      if (m.vy < -30) m.vy = -30;
      m.pos.y += m.vy * dt;
      const sy = w.surfaceY(Math.floor(m.pos.x), Math.floor(m.pos.z));
      const gy = sy >= 0 ? sy + 1 : m.pos.y;
      if (m.pos.y <= gy) { m.pos.y = gy; m.vy = 0; }

      m.mesh.position.set(m.pos.x, m.pos.y, m.pos.z);
      m.mesh.rotation.y = m.yaw + Math.PI;
      m.walk += dt * speed * 6;
      const sw = speed > 0 ? Math.sin(m.walk) * 0.7 : 0;
      m.legs[0].rotation.x = sw; m.legs[3].rotation.x = sw;
      m.legs[1].rotation.x = -sw; m.legs[2].rotation.x = -sw;
      m.head.rotation.x = Math.sin(m.walk * 0.5) * 0.08;
    }
  }
};

})(typeof window !== 'undefined' ? window : globalThis);
