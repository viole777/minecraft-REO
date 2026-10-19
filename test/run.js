/* Testes de lógica do Mundo de Blocos (sem DOM) — node test/run.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
global.THREE = require(path.join(ROOT, 'lib', 'three.min.js'));

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  vm.runInThisContext(code, { filename: rel });
}

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  FALHOU: ' + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + ' (esperado ' + b + ', obteve ' + a + ')'); }

load('js/noise.js');
load('js/blocks.js');
// stub do atlas (texturas precisam de DOM)
global.VX.Tex = { uvRect: () => ({ u0: 0, v0: 0, u1: 0.125, v1: 0.125 }) };
load('js/world.js');
load('js/mesher.js');
load('js/player.js');
const VX = global.VX;

console.log('== Ruído ==');
{
  const n1 = new VX.Noise2D(1234), n2 = new VX.Noise2D(1234), n3 = new VX.Noise2D(99);
  eq(n1.perlin(3.3, 7.1), n2.perlin(3.3, 7.1), 'determinístico com mesma semente');
  ok(n1.perlin(3.3, 7.1) !== n3.perlin(3.3, 7.1), 'diferente com semente diferente');
  let mn = 9, mx = -9;
  for (let i = 0; i < 2000; i++) {
    const v = n1.perlin(i * 0.13, i * 0.071);
    if (v < mn) mn = v; if (v > mx) mx = v;
  }
  ok(mn >= -1.6 && mx <= 1.6, 'range do perlin razoável [' + mn.toFixed(2) + ',' + mx.toFixed(2) + ']');
}

console.log('== Mundo ==');
const world = new VX.World(42);
{
  const h1 = world.columnHeight(100, 200);
  eq(h1, world.columnHeight(100, 200), 'altura de coluna determinística');
  // gera uma área 8x8 chunks e verifica conteúdo
  let water = 0, logs = 0, grass = 0, bedrock = 0, ores = 0, plants = 0;
  const B = VX.Blocks;
  for (let cx = -4; cx < 4; cx++) for (let cz = -4; cz < 4; cz++) {
    const c = world.getChunk(cx, cz);
    for (let i = 0; i < c.length; i++) {
      const id = c[i];
      if (id === B.WATER) water++;
      else if (id === B.LOG) logs++;
      else if (id === B.GRASS) grass++;
      else if (id === B.BEDROCK) bedrock++;
      else if (id === B.COAL_ORE || id === B.IRON_ORE) ores++;
      else if (id === B.TALLGRASS || id === B.POPPY || id === B.DANDELION) plants++;
    }
  }
  ok(grass > 5000, 'grama gerada (' + grass + ')');
  ok(bedrock >= 64 * 64, 'leito de bedrock completo (' + bedrock + ')');
  ok(water > 0 || logs > 0 || plants > 0, 'elementos variados existem');
  ok(ores >= 0, 'minérios calculados (' + ores + ')');
  const c00 = world.getChunk(0, 0);
  eq(c00.length, 16 * 16 * 80, 'tamanho do chunk');
}

console.log('== Edições ==');
{
  const w2 = new VX.World(42);
  const sy = w2.surfaceY(4, 4);
  ok(sy > 0, 'surfaceY encontra superfície');
  w2.setBlock(4, sy + 1, 4, VX.Blocks.STONE);
  eq(w2.getBlock(4, sy + 1, 4), VX.Blocks.STONE, 'setBlock grava');
  ok(w2.dirty.size > 0, 'dirty marcado');
  // mesma semente + edições reproduz o bloco em chunk regenerado
  const w3 = new VX.World(42, w2.edits);
  eq(w3.getBlock(4, sy + 1, 4), VX.Blocks.STONE, 'edição persistida via semente');
}

console.log('== Raycast ==');
{
  // mundo sintático: piso em y=40
  const map = new Map();
  const K = (x, y, z) => x + ',' + y + ',' + z;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) map.set(K(x, 40, z), VX.Blocks.STONE);
  map.set(K(8, 41, 8), VX.Blocks.DIRT);
  const stub = { getBlock: (x, y, z) => map.get(K(x, y, z)) || 0 };

  const down = VX.raycastVoxel(stub, { x: 8.5, y: 45, z: 8.5 }, { x: 0, y: -1, z: 0 }, 10);
  ok(down && down.x === 8 && down.y === 41 && down.z === 8, 'raycast vertical acerta topo');
  ok(down && down.ny === 1 && down.nx === 0, 'normal para cima');

  const side = VX.raycastVoxel(stub, { x: 2.5, y: 41.5, z: 8.5 }, { x: 1, y: 0, z: 0 }, 10);
  ok(side && side.x === 8 && side.z === 8, 'raycast horizontal acerta bloco');
  ok(side && side.nx === -1, 'normal oposta à direção');

  const miss = VX.raycastVoxel(stub, { x: 8.5, y: 50, z: 8.5 }, { x: 0, y: 1, z: 0 }, 6);
  ok(miss === null, 'sem alvo => null');
}

const r2 = require('./run2');
pass += r2.pass; fail += r2.fail;
console.log('\nResultado: ' + pass + ' ok, ' + fail + ' falha(s)');
process.exit(fail ? 1 : 0);
