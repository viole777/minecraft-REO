/* Validação de persistência: save -> reload -> mesmo mundo
   node test/save.js */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/').replace(/ /g, '%20');

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE, headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  await page.goto(URL);
  await page.waitForSelector('#menu.visible', { timeout: 30000 });

  const first = await page.evaluate(() => {
    const app = window.app;
    const y = app.world.surfaceY(8, 8);
    app.world.setBlock(8, y + 1, 8, window.VX.Blocks.OBSIDIAN); // marcador
    app.save();
    return { seed: app.world.seed, y: y };
  });
  console.log('1) semente=' + first.seed + '; obsidiana em y=' + (first.y + 1));

  await page.reload();
  await page.waitForSelector('#menu.visible', { timeout: 30000 });

  const second = await page.evaluate((markerY) => {
    const app = window.app;
    return { seed: app.world.seed, block: app.world.getBlock(8, markerY, 8),
             surface: app.world.surfaceY(8, 8) };
  }, first.y + 1);
  console.log('2) semente=' + second.seed + '; bloco salvo(y=' + (first.y + 1) + ')=' + second.block +
              '; surfaceY=' + second.surface);

  const okSeed = second.seed === first.seed;
  const okBlock = second.block === 22; // OBSIDIAN
  console.log(okSeed ? 'OK: mesma semente após reload' : 'FALHOU: semente diferente');
  console.log(okBlock ? 'OK: edição persistida' : 'FALHOU: edição perdida (obteve ' + second.block + ')');
  if (errors.length) console.log('ERROS: ' + errors.join(' | '));

  await browser.close();
  process.exit(okSeed && okBlock && !errors.length ? 0 : 1);
})().catch((e) => { console.error('FATAL: ' + e.message); process.exit(2); });
