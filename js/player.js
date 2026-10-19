/* Mundo de Blocos - jogador: física AABB, colisão e raycast DDA (implementação original) */
;((g) => {
const VX = g.VX = g.VX || {};

const WIDTH = 0.6, HEIGHT = 1.8, EYE = 1.62;
const GRAVITY = 28, JUMP = 8.4, WALK = 4.3, SPRINT = 5.8, FLY = 12, REACH = 5;
VX.PCONST = { WIDTH, HEIGHT, EYE, GRAVITY, JUMP, WALK, SPRINT, FLY, REACH };

function aabbHits(world, px, py, pz) {
  const hw = WIDTH / 2;
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
  const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT);
  const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (VX.isSolid(world.getBlock(x, y, z))) return true;
  return false;
}
VX.aabbHits = aabbHits;

/* move em um eixo e resolve colisão; retorna true se colidiu */
function moveAxis(world, pos, d, axis) {
  if (d === 0) return false;
  pos[axis] += d;
  if (!aabbHits(world, pos.x, pos.y, pos.z)) return false;
  const hw = WIDTH / 2, eps = 1e-4;
  if (axis === 'y') {
    if (d > 0) pos.y = Math.floor(pos.y + HEIGHT) - HEIGHT - eps;
    else pos.y = Math.floor(pos.y) + 1 + eps;
  } else if (axis === 'x') {
    if (d > 0) pos.x = Math.floor(pos.x + hw) - hw - eps;
    else pos.x = Math.floor(pos.x - hw) + 1 + hw + eps;
  } else {
    if (d > 0) pos.z = Math.floor(pos.z + hw) - hw - eps;
    else pos.z = Math.floor(pos.z - hw) + 1 + hw + eps;
  }
  return true;
}
VX.moveAxis = moveAxis;

VX.Player = class {
  constructor(world) {
    this.world = world;
    this.pos = { x: 8.5, y: 45, z: 8.5 };   // centro dos pés
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.flying = false; this.inWater = false;
    this.bobPhase = 0; this.bobOffset = 0;
    this.stepTimer = 0;
  }

  spawn() {
    const y = this.world.surfaceY(8, 8);
    this.pos = { x: 8.5, y: (y >= 0 ? y + 1 : 45) + 0.01, z: 8.5 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.onGround = false; this.flying = false;
  }

  eye() {
    return { x: this.pos.x, y: this.pos.y + EYE + this.bobOffset, z: this.pos.z };
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp
    };
  }

  lookAt() {
    const o = this.eye(), d = this.lookDir();
    return VX.raycastVoxel(this.world, o, d, REACH);
  }

  update(dt, ctl) {
    const w = this.world;
    // água na altura dos pés/cabeça
    const feetId = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    const headId = w.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z));
    this.inWater = VX.isLiquid(feetId) || VX.isLiquid(headId);
    this.headInWater = VX.isLiquid(headId);

    // direção desejada (relativa ao olhar)
    let fx = 0, fz = 0;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    fx = -sy * ctl.fwd + cy * ctl.strafe;
    fz = -cy * ctl.fwd - sy * ctl.strafe;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }

    let spd;
    if (this.flying) spd = ctl.sprint ? FLY * 1.7 : FLY;
    else spd = (ctl.sprint && ctl.fwd > 0 ? SPRINT : WALK) * (ctl.sneak ? 0.35 : 1) * (this.inWater ? 0.6 : 1);

    this.vel.x = fx * spd;
    this.vel.z = fz * spd;

    if (this.flying) {
      this.vel.y = (ctl.jump ? FLY : 0) + (ctl.sneak ? -FLY : 0);
    } else if (this.inWater) {
      this.vel.y -= GRAVITY * 0.32 * dt;
      if (this.vel.y < -3.2) this.vel.y = -3.2;
      if (ctl.jump) this.vel.y = 3.4;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -55) this.vel.y = -55;
      if (ctl.jump && this.onGround) this.vel.y = JUMP;
    }

    this.onGround = false;
    moveAxis(w, this.pos, this.vel.x * dt, 'x');
    moveAxis(w, this.pos, this.vel.z * dt, 'z');
    if (moveAxis(w, this.pos, this.vel.y * dt, 'y')) {
      if (this.vel.y <= 0) this.onGround = true;
      this.vel.y = 0;
    }

    // balanço da câmera e passos
    const hsp = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hsp > 0.5 && !this.flying) {
      this.bobPhase += dt * hsp * 1.85;
      this.bobOffset = Math.sin(this.bobPhase * 2) * 0.035;
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = 0.42; if (VX.SFX) VX.SFX.step(); }
    } else {
      this.bobOffset *= 0.8;
    }
  }
};

/* Raycast DDA (grade de voxels) */
VX.raycastVoxel = function (world, o, d, maxDist) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
  const tdx = d.x !== 0 ? Math.abs(1 / d.x) : Infinity;
  const tdy = d.y !== 0 ? Math.abs(1 / d.y) : Infinity;
  const tdz = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
  let tMaxX = d.x !== 0 ? (stepX > 0 ? (x + 1 - o.x) : (o.x - x)) * tdx : Infinity;
  let tMaxY = d.y !== 0 ? (stepY > 0 ? (y + 1 - o.y) : (o.y - y)) * tdy : Infinity;
  let tMaxZ = d.z !== 0 ? (stepZ > 0 ? (z + 1 - o.z) : (o.z - z)) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;

  for (let i = 0; i < 160; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== 0 && !VX.isLiquid(id)) {
      return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, id: id, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tdx; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tdy; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tdz; nx = 0; ny = 0; nz = -stepZ;
    }
    if (t > maxDist) break;
  }
  return null;
};

/* o AABB do jogador sobrepõe o bloco (bx,by,bz)? */
VX.playerOverlapsBlock = function (pos, bx, by, bz) {
  const hw = WIDTH / 2;
  return pos.x + hw > bx && pos.x - hw < bx + 1 &&
         pos.y + HEIGHT > by && pos.y < by + 1 &&
         pos.z + hw > bz && pos.z - hw < bz + 1;
};

})(typeof window !== 'undefined' ? window : globalThis);

