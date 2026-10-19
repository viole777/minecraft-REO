/* Mundo de Blocos - aplicação principal (cena, streaming de chunks, entradas, laço) */
;((g) => {
const VX = g.VX = g.VX || {};

const SAVE_KEY = 'mundoDeBlocos.save';
const SET_KEY = 'mundoDeBlocos.settings';

function loadJSON(key) { try { const s = g.localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveJSON(key, v) { try { g.localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

class App {
  constructor() {
    this.state = 'boot';
    this.settings = Object.assign({ fov: 70, sens: 1, renderDist: 6, muted: false }, loadJSON(SET_KEY));
    this.hotbar = VX.hotbarDefault.slice();
    this.selected = 0;
    this.keys = {};
    this.mouse = { left: false, right: false };
    this.actTimer = 0; this.autosaveT = 0;
    this.fps = 0; this.frames = 0; this.fpsT = 0; this.debugOn = false;
    this.menuAngle = 0; this.lastSpace = 0; this.locked = false; this._under = false;
    this.chunkMeshes = new Map();
    this.particles = [];
    this.particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    const canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, 2));
    this.renderer.setSize(g.innerWidth, g.innerHeight);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, g.innerWidth / g.innerHeight, 0.1, 1200);
    this.camera.rotation.order = 'YXZ';

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe4f5, 40, 160);

    // céu com gradiente
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x5b8cd8) },
        bottomColor: { value: new THREE.Color(0xcfe4f5) }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vP; void main(){ float t = clamp(normalize(vP).y * 1.5 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 16, 12), skyMat);
    this.sky.renderOrder = -1000;
    this.scene.add(this.sky);

    // sol quadrado
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(70, 70),
      new THREE.MeshBasicMaterial({ color: 0xfff8d0, fog: false, depthWrite: false, transparent: true, opacity: 0.95 }));
    this.sun.renderOrder = -999;
    this.scene.add(this.sun);

    // nuvens em bloco
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false, depthWrite: false });
    const crnd = VX.mulberry32(99);
    for (let i = 0; i < 60; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cloudMat);
      c.scale.set(18 + crnd() * 40, 4, 12 + crnd() * 30);
      c.position.set((crnd() - 0.5) * 1100, 110 + crnd() * 6, (crnd() - 0.5) * 1100);
      this.clouds.add(c);
    }
    this.scene.add(this.clouds);

    // luzes (afetam apenas os animais; blocos usam vértices)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
    dir.position.set(0.5, 1, 0.25);
    this.scene.add(dir);

    // materiais das malhas
    const tex = VX.Tex.init();
    this.mats = {
      solid: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 }),
      cross: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide })
    };

    // contorno do bloco mirado
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003)),
      new THREE.LineBasicMaterial({ color: 0x111111 })
    );
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.ui = new VX.UI(this);
    this._bindEvents();
    this.applySettings();
  }

  boot() {
    this.ui.show('loading');
    this.ui.setProgress(0.05, 'Preparando o terreno…');
    const save = loadJSON(SAVE_KEY);
    const seed = save && typeof save.seed === 'number' ? save.seed : (Math.random() * 1e9) | 0;
    const edits = new Map();
    if (save && save.edits) for (const k in save.edits) edits.set(k, save.edits[k]);
    this._createWorld(seed, edits);
    this._loadInitial().then(() => {
      this.state = 'menu';
      this.ui.show('menu');
      this._loop();
    });
  }

  newWorld() {
    try { g.localStorage.removeItem(SAVE_KEY); } catch (e) {}
    this.state = 'loading';
    this.ui.show('loading');
    this.ui.setProgress(0.05, 'Gerando novo mundo…');
    const seed = (Math.random() * 1e9) | 0;
    this._disposeWorld();
    this._createWorld(seed, new Map());
    this._loadInitial().then(() => this.enterGame());
  }

  _createWorld(seed, edits) {
    this.world = new VX.World(seed, edits);
    this.player = new VX.Player(this.world);
    this.player.spawn();
    if (this.mobs) this.mobs.clear();
    this.mobs = new VX.Mobs(this.world, this.scene);
  }

  _disposeWorld() {
    for (const m of this.chunkMeshes.values()) this._disposeMeshes(m);
    this.chunkMeshes.clear();
  }

  _loadInitial() {
    // gera e malha a área inicial ao redor do spawn, com progresso visível
    return new Promise((resolve) => {
      const R = 3, list = [];
      const pcx = Math.floor(this.player.pos.x / 16), pcz = Math.floor(this.player.pos.z / 16);
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) list.push([pcx + dx, pcz + dz]);
      list.sort((a, b) =>
        ((a[0] - pcx) * (a[0] - pcx) + (a[1] - pcz) * (a[1] - pcz)) -
        ((b[0] - pcx) * (b[0] - pcx) + (b[1] - pcz) * (b[1] - pcz)));
      let i = 0;
      const genStep = () => {
        const t0 = performance.now();
        while (i < list.length && performance.now() - t0 < 24) { this.world.getChunk(list[i][0], list[i][1]); i++; }
        this.ui.setProgress(0.05 + 0.55 * (i / list.length), 'Gerando terreno…');
        if (i < list.length) requestAnimationFrame(genStep);
        else {
          let bi = 0;
          const meshStep = () => {
            const t1 = performance.now();
            while (bi < list.length && performance.now() - t1 < 24) { this._buildChunkMesh(list[bi][0], list[bi][1]); bi++; }
            this.ui.setProgress(0.6 + 0.4 * (bi / list.length), 'Construindo chunks…');
            if (bi < list.length) requestAnimationFrame(meshStep);
            else resolve();
          };
          meshStep();
        }
      };
      genStep();
    });
  }

  updateChunks(fast) {
    const R = this.settings.renderDist;
    const pcx = Math.floor(this.player.pos.x / 16), pcz = Math.floor(this.player.pos.z / 16);
    // descarrega distantes
    for (const [k, m] of this.chunkMeshes) {
      const p = k.split(',');
      if (Math.abs(+p[0] - pcx) > R + 2 || Math.abs(+p[1] - pcz) > R + 2) {
        this._disposeMeshes(m);
        this.chunkMeshes.delete(k);
        this.world.chunks.delete(k);
      }
    }
    // filas por distância
    const gen = [], mesh = [];
    const lim = (R + 0.5) * (R + 0.5);
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const dd = dx * dx + dz * dz;
      if (dd > lim) continue;
      const cx = pcx + dx, cz = pcz + dz, k = cx + ',' + cz;
      if (!this.world.chunks.has(k)) gen.push([cx, cz, dd]);
      else if (this.world.dirty.has(k) || !this.chunkMeshes.has(k)) mesh.push([cx, cz, dd]);
    }
    gen.sort((a, b) => a[2] - b[2]); mesh.sort((a, b) => a[2] - b[2]);
    const gN = fast ? 6 : 2, mN = fast ? 8 : 2;
    for (let i = 0; i < Math.min(gN, gen.length); i++) this.world.getChunk(gen[i][0], gen[i][1]);
    for (let i = 0; i < Math.min(mN, mesh.length); i++) {
      this._buildChunkMesh(mesh[i][0], mesh[i][1]);
      this.world.dirty.delete(mesh[i][0] + ',' + mesh[i][1]);
    }
  }

  _disposeMeshes(m) {
    for (const key of ['solid', 'cross', 'water']) {
      if (m[key]) { this.scene.remove(m[key]); m[key].geometry.dispose(); m[key] = null; }
    }
  }

  _buildChunkMesh(cx, cz) {
    const k = cx + ',' + cz;
    const old = this.chunkMeshes.get(k);
    if (old) this._disposeMeshes(old);
    const geo = VX.buildChunkGeometry(this.world, cx, cz);
    const entry = {};
    const mk = (b, mat, order) => {
      if (!b.idx.length) return null;
      const gm = new THREE.BufferGeometry();
      gm.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      gm.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      gm.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      gm.setIndex(b.idx);
      const mesh = new THREE.Mesh(gm, mat);
      mesh.position.set(cx * 16, 0, cz * 16);
      if (order !== undefined) mesh.renderOrder = order;
      this.scene.add(mesh);
      return mesh;
    };
    entry.solid = mk(geo.solid, this.mats.solid);
    entry.cross = mk(geo.cross, this.mats.cross);
    entry.water = mk(geo.water, this.mats.water, 2);
    this.chunkMeshes.set(k, entry);
  }

  _bindEvents() {
    const canvas = this.renderer.domElement;
    g.addEventListener('resize', () => {
      this.camera.aspect = g.innerWidth / g.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(g.innerWidth, g.innerHeight);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.state === 'playing') { this.state = 'paused'; this.ui.show('pause'); }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.state !== 'playing') return;
      const s = 0.0023 * this.settings.sens;
      this.player.yaw -= e.movementX * s;
      this.player.pitch -= e.movementY * s;
      const lim = Math.PI / 2 - 0.01;
      this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
    });

    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      VX.SFX.resume();
      if (!this.locked) { this._lock(); return; }
      if (e.button === 0) { this.mouse.left = true; this._breakBlock(); this.actTimer = 0.28; }
      else if (e.button === 2) { this.mouse.right = true; this._placeBlock(); this.actTimer = 0.25; }
      else if (e.button === 1) { e.preventDefault(); this._pickBlock(); }
    });
    g.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });

    g.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      this.selected = ((this.selected + (e.deltaY > 0 ? 1 : -1)) % 9 + 9) % 9;
      this.ui.refreshHotbar();
      const id = this.hotbar[this.selected];
      if (id) this.ui.toast(VX.blockDef(id).name);
    }, { passive: true });

    g.addEventListener('keydown', (e) => {
      if (e.code === 'F3') { e.preventDefault(); this.debugOn = !this.debugOn; if (!this.debugOn) this.ui.setDebug(''); return; }
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0) e.preventDefault();
      this.keys[e.code] = true;
      if (e.repeat) return;

      if (this.state === 'playing') {
        if (e.code === 'Escape') {
          // cobre o caso de pointer lock não ativo (o browser só entrega Esc quando não travado)
          this.state = 'paused'; this.ui.show('pause');
          if (document.pointerLockElement) document.exitPointerLock();
          return;
        }
        if (e.code === 'KeyE') { this.toggleInventory(true); return; }
        if (e.code.indexOf('Digit') === 0) {
          const n = +e.code.slice(5);
          if (n >= 1 && n <= 9) {
            this.selected = n - 1;
            this.ui.refreshHotbar();
            const id = this.hotbar[this.selected];
            if (id) this.ui.toast(VX.blockDef(id).name);
          }
          return;
        }
        if (e.code === 'Space') {
          const now = performance.now();
          if (now - this.lastSpace < 280) {
            this.player.flying = !this.player.flying;
            this.ui.toast(this.player.flying ? 'Modo voo: ligado' : 'Modo voo: desligado');
          }
          this.lastSpace = now;
        }
      } else if (this.state === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyE') this.resume();
      } else if (this.state === 'inventory') {
        if (e.code === 'Escape' || e.code === 'KeyE') this.toggleInventory(false);
      } else if (this.state === 'menu') {
        if (e.code === 'Enter') this.enterGame();
      }
    });
    g.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    g.addEventListener('blur', () => { this.keys = {}; this.mouse.left = this.mouse.right = false; });
    g.addEventListener('beforeunload', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  _lock() {
    const c = this.renderer.domElement;
    if (document.pointerLockElement !== c) {
      try {
        const p = c.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }
  }

  enterGame() {
    this.state = 'playing';
    this.ui.show('none');
    this._lock();
    this.ui.showHint(
      'WASD mover · Espaço pular · Ctrl correr · Shift agachar/nadar para baixo<br>' +
      'Botão esq. quebrar · Botão dir. colocar · Botão do meio copiar bloco · Roda ou 1-9 hotbar<br>' +
      'E inventário · Duplo Espaço voar · ESC pausa · F3 debug', 9500);
    if (!this._hintShown) { this._hintShown = true; }
  }

  resume() {
    this.state = 'playing';
    this.ui.show('none');
    this._lock();
  }

  quitToMenu() {
    this.save();
    this.state = 'menu';
    this.ui.show('menu');
  }

  toggleInventory(open) {
    if (open) {
      this.state = 'inventory';
      this.ui.show('inventory');
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      this.state = 'playing';
      this.ui.show('none');
      this._lock();
    }
  }

  _breakBlock() {
    const hit = this.player.lookAt();
    if (!hit || !VX.isBreakable(hit.id)) return;
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this._spawnParticles(hit);
    VX.SFX.dig();
    this.ui.swing();
  }

  _placeBlock() {
    const hit = this.player.lookAt();
    if (!hit) return;
    const id = this.hotbar[this.selected];
    if (!id) return;
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    const cur = this.world.getBlock(x, y, z);
    if (!VX.isReplaceable(cur)) return;
    if (VX.isSolid(id) && VX.playerOverlapsBlock(this.player.pos, x, y, z)) return;
    this.world.setBlock(x, y, z, id);
    VX.SFX.place();
    this.ui.swing();
  }

  _pickBlock() {
    const hit = this.player.lookAt();
    if (!hit) return;
    if (VX.itemList.indexOf(hit.id) < 0) return;
    this.hotbar[this.selected] = hit.id;
    this.ui.refreshHotbar();
    this.ui.toast(VX.blockDef(hit.id).name + ' (copiado)');
  }

  _spawnParticles(hit) {
    const d = VX.blockDef(hit.id);
    const col = VX.Tex.avgColor(d.tiles.side);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]) });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(this.particleGeo, mat);
      m.position.set(hit.x + 0.2 + Math.random() * 0.6, hit.y + 0.2 + Math.random() * 0.6, hit.z + 0.2 + Math.random() * 0.6);
      this.scene.add(m);
      this.particles.push({
        mesh: m, mat: mat,
        vx: (Math.random() - 0.5) * 3.2, vy: 2 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 3.2,
        life: 0.5 + Math.random() * 0.3
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy -= 15 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 5; p.mesh.rotation.y += dt * 4;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        if (!this.particles.some((q) => q.mat === p.mat)) p.mat.dispose();
      }
    }
  }

  applySettings() {
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();
    VX.SFX.setVolume(this.settings.muted ? 0 : 0.6);
    const R = this.settings.renderDist;
    if (!this._under) {
      this.scene.fog.near = R * 16 * 0.5;
      this.scene.fog.far = R * 16 * 0.92;
    }
    saveJSON(SET_KEY, this.settings);
  }

  save() {
    if (!this.world) return;
    const edits = {};
    for (const e of this.world.edits) edits[e[0]] = e[1];
    saveJSON(SAVE_KEY, { seed: this.world.seed, edits: edits });
  }

  _loop() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try { this._update(dt); } catch (e) { console.error(e); }
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  _update(dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }

    const p = this.player;
    if (this.state === 'playing') {
      const k = this.keys;
      const ctl = {
        fwd: ((k['KeyW'] || k['ArrowUp']) ? 1 : 0) - ((k['KeyS'] || k['ArrowDown']) ? 1 : 0),
        strafe: ((k['KeyD'] || k['ArrowRight']) ? 1 : 0) - ((k['KeyA'] || k['ArrowLeft']) ? 1 : 0),
        jump: !!k['Space'],
        sneak: !!(k['ShiftLeft'] || k['ShiftRight']),
        sprint: !!(k['ControlLeft'] || k['ControlRight'])
      };
      p.update(dt, ctl);

      if (this.mouse.left || this.mouse.right) {
        this.actTimer -= dt;
        if (this.actTimer <= 0) {
          if (this.mouse.left) { this._breakBlock(); this.actTimer = 0.22; }
          else { this._placeBlock(); this.actTimer = 0.20; }
        }
      }

      const hit = p.lookAt();
      if (hit) {
        this.outline.visible = true;
        this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else this.outline.visible = false;

      const e = p.eye();
      this.camera.position.set(e.x, e.y, e.z);
      this.camera.rotation.y = p.yaw;
      this.camera.rotation.x = p.pitch;

      const under = !!p.headInWater;
      if (under !== this._under) {
        this._under = under;
        this.ui.setUnderwater(under);
        this.scene.fog.color.setHex(under ? 0x1c4a86 : 0xcfe4f5);
        this.scene.fog.near = under ? 0.1 : this.settings.renderDist * 16 * 0.5;
        this.scene.fog.far = under ? 14 : this.settings.renderDist * 16 * 0.92;
      }

      this.mobs.update(dt, p.pos);
      this.updateChunks(false);

      this.autosaveT += dt;
      if (this.autosaveT > 20) { this.autosaveT = 0; this.save(); }

      if (this.debugOn) {
        this.ui.setDebug(
          'FPS: ' + this.fps +
          '\nXYZ: ' + p.pos.x.toFixed(2) + ' / ' + p.pos.y.toFixed(2) + ' / ' + p.pos.z.toFixed(2) +
          '\nChunk: ' + Math.floor(p.pos.x / 16) + ', ' + Math.floor(p.pos.z / 16) +
          '\nSemente: ' + this.world.seed +
          '\nChunks carregados: ' + this.chunkMeshes.size +
          (p.flying ? '\nVoo: ligado' : '') + (p.inWater ? '\nNa água' : ''));
      }

      // balanço da mão
      const bobY = Math.sin(p.bobPhase * 2) * 7;
      this.ui.el.hand.style.transform = 'translateY(' + bobY.toFixed(1) + 'px)';

    } else if (this.state === 'menu' || this.state === 'loading' || this.state === 'boot') {
      // panorama orbitando o spawn
      this.menuAngle += dt * 0.05;
      const sy = this.world ? Math.max(this.world.surfaceY(8, 8), 20) + 13 : 50;
      this.camera.position.set(8.5 + Math.sin(this.menuAngle) * 27, sy, 8.5 + Math.cos(this.menuAngle) * 27);
      this.camera.rotation.y = this.menuAngle;
      this.camera.rotation.x = -0.25;
      if (this.state === 'menu') this.updateChunks(false);
    }

    this._updateParticles(dt);

    // nuvens deslizando
    this._cloudX = (this._cloudX || 0) + dt * 1.1;
    if (this._cloudX > 550) this._cloudX -= 1100;
    this.clouds.position.x = this._cloudX;

    // céu e sol seguem a câmera (infinitamente distantes)
    this.sky.position.copy(this.camera.position);
    this.sun.position.set(this.camera.position.x + 170, this.camera.position.y + 330, this.camera.position.z - 230);
    this.sun.lookAt(this.camera.position);
  }
}

function start() {
  try {
    const app = new App();
    g.app = app;
    app.boot();
  } catch (err) {
    console.error(err);
    const box = document.getElementById('boot-error');
    if (box) {
      box.style.display = 'block';
      box.textContent = 'Falha ao iniciar: ' + (err && err.message ? err.message : err);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

})(typeof window !== 'undefined' ? window : globalThis);



