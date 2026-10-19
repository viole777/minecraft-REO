/* Validação em navegador headless: menu -> jogo -> inventário -> ações
   node test/shots.js */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');
const OUT = (n) => path.join(__dirname, n);

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForSelector('#menu.visible', { timeout: 30000 });
  console.log('OK: menu visível');

  // entra no jogo
  await page.click('#btn-play');
  await page.waitForTimeout(1200);
  let state = await page.evaluate(() => window.app.state);
  console.log('após btn-play: state=' + state);
  await page.screenshot({ path: OUT('shot-game.png') });

  // movimento WASD
  const before = await page.evaluate(() => Object.assign({}, window.app.player.pos));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => Object.assign({}, window.app.player.pos));
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  console.log('movimento W: ' + moved.toFixed(2) + ' blocos');
  if (moved < 1) errors.push('VALIDACAO: jogador não andou com W');

  // olha para baixo e quebra/coloca bloco pela lógica do jogo
  const actions = await page.evaluate(() => {
    const app = window.app;
    app.player.pitch = -1.2;
    const edits0 = app.world.edits.size;
    const hit0 = app.player.lookAt();
    app._breakBlock();
    const broke = app.world.edits.size > edits0;
    let placed = false, usedPitch = null;
    for (const p of [-0.5, -0.7, -0.9, -1.05, -1.25, -1.45]) {
      app.player.pitch = p;
      if (!app.player.lookAt()) continue;
      const before = app.world.edits.size;
      app._placeBlock();
      if (app.world.edits.size > before) { placed = true; usedPitch = p; break; }
    }
    app.player.pitch = 0;
    return { hit0: !!hit0, broke: broke, placed: usedPitch, editsEnd: app.world.edits.size };
  });
  console.log('ações: mirou=' + actions.hit0 + ' quebrou=' + actions.broke +
              ' colocou(pitch=' + actions.placed + ') edições=' + actions.editsEnd);
  if (!actions.hit0) errors.push('VALIDACAO: lookAt não achou bloco olhando pra baixo');
  if (!actions.broke) errors.push('VALIDACAO: _breakBlock não alterou o mundo');
  if (!actions.placed) errors.push('VALIDACAO: _placeBlock não conseguiu colocar bloco');

  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT('shot-game2.png') });

  // inventário (E)
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  state = await page.evaluate(() => window.app.state);
  console.log('após E: state=' + state);
  if (state !== 'inventory') errors.push('VALIDACAO: inventário não abriu (state=' + state + ')');
  // busca
  await page.fill('#inv-search', 'pedra');
  await page.waitForTimeout(250);
  const visible = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#inv-grid .item')).filter((e) => e.style.display !== 'none').length);
  console.log('busca "pedra": ' + visible + ' resultado(s)');
  if (visible < 1) errors.push('VALIDACAO: busca não filtrou itens');
  await page.screenshot({ path: OUT('shot-inv.png') });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);

  // pause via ESC (com ou sem pointer lock ativo)
  await page.evaluate(() => { window.app.state = 'playing'; });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  state = await page.evaluate(() => window.app.state);
  console.log('após ESC: state=' + state);
  if (state !== 'paused') errors.push('VALIDACAO: ESC não pausou (state=' + state + ')');
  // volta ao jogo pelo botão
  await page.click('#btn-resume');
  await page.waitForTimeout(200);
  const st2 = await page.evaluate(() => window.app.state);
  if (st2 !== 'playing') errors.push('VALIDACAO: btn-resume não voltou (state=' + st2 + ')');
  console.log('após btn-resume: state=' + st2);

  // debug F3
  await page.evaluate(() => { window.app.state = 'playing'; });
  await page.keyboard.press('F3');
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT('shot-debug.png') });
  const dbg = await page.evaluate(() => document.getElementById('debug').textContent);
  console.log('debug:\n' + dbg);

  const metrics = await page.evaluate(() => ({
    chunks: window.app.chunkMeshes.size,
    fps: window.app.fps,
    meshes: window.app.scene.children.length
  }));
  console.log('métricas: ' + JSON.stringify(metrics));

  console.log(errors.length ? '\nPROBLEMAS:\n' + errors.join('\n') : '\nSEM ERROS DE PÁGINA/NAS VALIDAÇÕES');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
