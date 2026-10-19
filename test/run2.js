/* Testes de malha e física — carregado por run.js (usa VX já carregado) */
'use strict';
const VX = global.VX;
const THREE = global.THREE;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  FALHOU: ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (esperado ' + b + ', obteve ' + a + ')'); }

console.log('== Malha (mesher) ==');
function stubWorld(cells) {
  const K = (x, y, z) => x + ',' + y + ',' + z;
  const map = new Map();
  for (const c of cells) map.set(K(c[0], c[1], c[2]), c[3]);
  return { getBlock: (x, y, z) => map.get(K(x, y, z)) || 0 };
}

// bloco isolado em (5,40,5)
{
  const w = stubWorld([[5, 40, 5, VX.Blocks.STONE]]);
  const geo = VX.buildChunkGeometry(w, 0, 0);
  eq(geo.solid.idx.length, 36, 'bloco isolado: 6 faces x 2 triângulos x 3 índices');
  eq(geo.solid.pos.length, 24 * 3, 'bloco isolado: 24 vértices');
  eq(geo.cross.idx.length, 0, 'sem blocos em cruz');
  eq(geo.water.idx.length, 0, 'sem água');

  // winding: as 6 normais geométricas devem ser os 6 eixos
  const normals = [];
  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    const v = (i) => new THREE.Vector3(
      geo.solid.pos[(base + i) * 3], geo.solid.pos[(base + i) * 3 + 1], geo.solid.pos[(base + i) * 3 + 2]);
    const n = new THREE.Vector3().subVectors(v(1), v(0)).cross(new THREE.Vector3().subVectors(v(2), v(0))).normalize();
    normals.push([Math.round(n.x), Math.round(n.y), Math.round(n.z)].join(','));
  }
  const expected = ['0,1,0', '0,-1,0', '0,0,1', '0,0,-1', '1,0,0', '-1,0,0'];
  for (const e of expected) ok(normals.indexOf(e) >= 0, 'normal da face ' + e + ' presente (obtidas: ' + normals.join(' | ') + ')');
}

// dois blocos adjacentes: face compartilhada ocluída (10 faces)
{
  const w = stubWorld([[5, 40, 5, VX.Blocks.STONE], [6, 40, 5, VX.Blocks.DIRT]]);
  const geo = VX.buildChunkGeometry(w, 0, 0);
  eq(geo.solid.idx.length, 60, 'dois blocos juntos: 10 faces');
}

// bloco em cruz
{
  const w = stubWorld([[5, 40, 5, VX.Blocks.TALLGRASS]]);
  const geo = VX.buildChunkGeometry(w, 0, 0);
  eq(geo.solid.idx.length, 0, 'cruz não gera faces sólidas');
  eq(geo.cross.idx.length, 12, 'cruz: 2 quadros (2 triângulos cada)');
}

// água: topo rebaixado quando exposta ao ar
{
  const cells = [[5, 40, 5, VX.Blocks.WATER]];
  const w = stubWorld(cells);
  const geo = VX.buildChunkGeometry(w, 0, 0);
  eq(geo.water.idx.length, 36, 'água isolada: 6 faces expostas ao ar');
  // topo deve estar rebaixado em 0.88
  let maxY = -1e9;
  for (let i = 1; i < geo.water.pos.length; i += 3) if (geo.water.pos[i] > maxY) maxY = geo.water.pos[i];
  ok(Math.abs(maxY - 40.88) < 1e-6, 'topo da água a 0.88 (obtido ' + maxY + ')');
}

// integridade dos buffers numa área real
{
  const world = new VX.World(7);
  for (let cx = 0; cx < 2; cx++) for (let cz = 0; cz < 2; cz++) world.getChunk(cx, cz);
  const geo = VX.buildChunkGeometry(world, 0, 0);
  for (const name of ['solid', 'cross', 'water']) {
    const b = geo[name];
    const nv = b.pos.length / 3;
    ok(b.uv.length === nv * 2, name + ': uv acompanha vértices');
    ok(b.col.length === nv * 3, name + ': cores acompanham vértices');
    ok(b.idx.length % 3 === 0, name + ': índices múltiplos de 3');
    let max = -1, min = 1e9, hasNaN = false;
    for (const i of b.idx) { if (i > max) max = i; if (i < min) min = i; }
    for (const v of b.pos) if (Number.isNaN(v)) hasNaN = true;
    ok(!hasNaN && (nv === 0 || (min >= 0 && max < nv)), name + ': índices válidos');
  }
  ok(geo.solid.idx.length > 1000, 'área real gera geometria substancial (' + geo.solid.idx.length + ' idx)');
}

console.log('== Física ==');
{
  // piso: y=40 cheio + parede em (9,41,8)
  const K = (x, y, z) => x + ',' + y + ',' + z;
  const map = new Map();
  for (let x = -8; x < 24; x++) for (let z = -8; z < 24; z++) for (let y = 30; y <= 40; y++) map.set(K(x, y, z), VX.Blocks.STONE);
  map.set(K(9, 41, 8), VX.Blocks.STONE); // parede de teste
  const world = { getBlock: (x, y, z) => map.get(K(x, y, z)) || 0 };

  ok(VX.aabbHits(world, 8.5, 41.0, 8.5) === false, 'acima do piso (pés em 41): sem colisão');
  ok(VX.aabbHits(world, 8.5, 40.5, 8.5) === true, 'dentro do piso (pés em 40.5): colisão');

  // queda e aterrissagem
  const player = new VX.Player(world);
  player.pos = { x: 8.5, y: 45, z: 8.5 };
  const ctl = { fwd: 0, strafe: 0, jump: false, sneak: false, sprint: false };
  let landed = false;
  for (let i = 0; i < 300; i++) {
    player.update(1 / 60, ctl);
    if (player.onGround) { landed = true; break; }
  }
  ok(landed, 'jogador aterra após queda');
  eq(Math.round(player.pos.y * 100) / 100, 41, 'pousa exatamente em y=41 (topo do piso em 40)');

  // pular
  player.update(1 / 60, Object.assign({}, ctl, { jump: true }));
  ok(player.vel.y > 5, 'pulo dá impulso positivo (' + player.vel.y.toFixed(1) + ')');

  // parede: moveAxis trava e recua até a borda da célula
  const pos = { x: 8.7, y: 41.01, z: 8.5 };
  const hit = VX.moveAxis(world, pos, 0.5, 'x');
  ok(hit, 'colisão horizontal detectada');
  const expectedX = 9 - 0.3 - 1e-4; // encosta na parede em x=9
  ok(Math.abs(pos.x - expectedX) < 1e-6, 'recuo exato na parede (x=' + pos.x + ')');

  // overlap de bloco p/ colocação
  ok(VX.playerOverlapsBlock({ x: 8.5, y: 41, z: 8.5 }, 8, 41, 8) === true, 'sobrepõe bloco em si mesmo');
  ok(VX.playerOverlapsBlock({ x: 8.5, y: 41, z: 8.5 }, 12, 41, 8) === false, 'não sobrepõe bloco distante');
}

module.exports = { pass, fail };
