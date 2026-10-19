/* Mundo de Blocos - interface (menu, hotbar, inventário, pause, opções) */
;((g) => {
const VX = g.VX = g.VX || {};

VX.UI = class {
  constructor(app) {
    this.app = app;
    const $ = (id) => document.getElementById(id);
    this.el = {
      loading: $('loading'), loadBar: $('load-bar'), loadText: $('load-text'),
      menu: $('menu'), splash: $('splash'),
      hud: $('hud'), hotbar: $('hotbar'), itemName: $('item-name'),
      hand: $('hand'), arm: $('arm'), held: $('held'), hint: $('hint'),
      debug: $('debug'), underwater: $('underwater'),
      pause: $('pause'), inventory: $('inventory'),
      invSearch: $('inv-search'), invGrid: $('inv-grid'), invHotbar: $('inv-hotbar'),
      options: $('options'), about: $('about'),
      optFov: $('opt-fov'), optSens: $('opt-sens'), optDist: $('opt-dist'), optMute: $('opt-mute'),
      fovVal: $('fov-val'), sensVal: $('sens-val'), distVal: $('dist-val')
    };

    const SPLASHES = [
      '100% feito de blocos!', 'Sem download!', 'Roda até no seu navegador!',
      'Cuidado com o chunk vazio!', 'As ovelhas não mordem!', 'Engenharia reversa do comportamento!',
      'Texturas desenhadas por código!', 'Aperte F3 para debug!', 'Duplo espaço = modo voar!'
    ];
    this.el.splash.textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0];

    // menu
    $('btn-play').onclick = () => { VX.SFX.click(); app.enterGame(); };
    $('btn-new').onclick = () => { VX.SFX.click(); app.newWorld(); };
    $('btn-menu-options').onclick = () => { VX.SFX.click(); this.show('options'); this.el.options.dataset.from = 'menu'; };
    $('btn-about').onclick = () => { VX.SFX.click(); this.show('about'); };
    // pause
    $('btn-resume').onclick = () => { VX.SFX.click(); app.resume(); };
    $('btn-pause-options').onclick = () => { VX.SFX.click(); this.show('options'); this.el.options.dataset.from = 'pause'; };
    $('btn-quit').onclick = () => { VX.SFX.click(); app.quitToMenu(); };
    // overlays
    $('btn-options-back').onclick = () => { VX.SFX.click(); this.backFromOptions(); };
    $('btn-about-back').onclick = () => { VX.SFX.click(); this.show(app.state === 'menu' ? 'menu' : 'pause'); };

    // opções
    const opt = () => app.applySettings();
    this.el.optFov.oninput = () => { app.settings.fov = +this.el.optFov.value; this.el.fovVal.textContent = app.settings.fov; opt(); };
    this.el.optSens.oninput = () => { app.settings.sens = +this.el.optSens.value / 100; this.el.sensVal.textContent = this.el.optSens.value; opt(); };
    this.el.optDist.oninput = () => { app.settings.renderDist = +this.el.optDist.value; this.el.distVal.textContent = this.el.optDist.value; opt(); };
    this.el.optMute.onchange = () => { app.settings.muted = this.el.optMute.checked; opt(); };

    // inventário
    this.el.invSearch.oninput = () => this.fillGrid();
    document.getElementById('inv-close').onclick = () => { VX.SFX.click(); app.toggleInventory(false); };

    this.buildHotbarDom();
    this.buildInventoryDom();
    this.refreshHotbar();
  }

  buildHotbarDom() {
    this.el.hotbar.innerHTML = '';
    this.slotImgs = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      const img = document.createElement('img');
      img.draggable = false;
      s.appendChild(img);
      s.onclick = () => { this.app.selected = i; this.refreshHotbar(); };
      this.el.hotbar.appendChild(s);
      this.slotImgs.push(img);
    }
    // hotbar interna do inventário
    this.el.invHotbar.innerHTML = '';
    this.invSlotEls = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      const img = document.createElement('img');
      img.draggable = false;
      s.appendChild(img);
      s.onclick = () => { this.app.selected = i; this.refreshHotbar(); };
      this.el.invHotbar.appendChild(s);
      this.invSlotEls.push({ el: s, img: img });
    }
  }

  buildInventoryDom() {
    this.el.invGrid.innerHTML = '';
    this.invItems = [];
    for (const id of VX.itemList) {
      const d = VX.blockDef(id);
      const s = document.createElement('div');
      s.className = 'slot item';
      s.title = d.name;
      const img = document.createElement('img');
      img.src = VX.Tex.iconDataURL(id);
      img.draggable = false;
      s.appendChild(img);
      s.onclick = () => {
        VX.SFX.click();
        this.app.hotbar[this.app.selected] = id;
        this.refreshHotbar();
        this.toast(d.name);
      };
      this.el.invGrid.appendChild(s);
      this.invItems.push({ el: s, name: d.name.toLowerCase() });
    }
  }

  fillGrid() {
    const q = this.el.invSearch.value.trim().toLowerCase();
    for (const it of this.invItems) it.el.style.display = (!q || it.name.indexOf(q) >= 0) ? '' : 'none';
  }

  refreshHotbar() {
    const app = this.app;
    for (let i = 0; i < 9; i++) {
      const id = app.hotbar[i];
      const src = id ? VX.Tex.iconDataURL(id) : '';
      this.slotImgs[i].src = src;
      this.invSlotEls[i].img.src = src;
      this.slotImgs[i].parentNode.classList.toggle('sel', i === app.selected);
      this.invSlotEls[i].el.classList.toggle('sel', i === app.selected);
    }
    this.el.held.src = app.hotbar[app.selected] ? VX.Tex.iconDataURL(app.hotbar[app.selected]) : '';
    this.el.arm.src = VX.Tex.armDataURL();
  }

  swing() {
    const h = this.el.hand;
    h.classList.remove('swing');
    void h.offsetWidth;          // reinicia a animação
    h.classList.add('swing');
  }

  toast(text) {
    const t = this.el.itemName;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 1400);
  }

  showHint(text, ms) {
    this.el.hint.innerHTML = text;
    this.el.hint.classList.add('show');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => this.el.hint.classList.remove('show'), ms || 7000);
  }

  /* alterna a tela visível: menu | loading | pause | inventory | options | about | none */
  show(name) {
    const screens = ['menu', 'loading', 'pause', 'inventory', 'options', 'about'];
    for (const s of screens) this.el[s].classList.toggle('visible', s === name);
    const ingame = this.app.state === 'playing' || this.app.state === 'paused' || this.app.state === 'inventory';
    this.el.hud.classList.toggle('visible', ingame && name !== 'menu');
    if (name === 'inventory') { this.el.invSearch.value = ''; this.fillGrid(); }
    if (name === 'options') this.syncOptions();
    if (name === 'pause') this.el.pause.classList.add('visible');
  }

  backFromOptions() {
    const from = this.el.options.dataset.from;
    this.show(from === 'menu' ? 'menu' : 'pause');
  }

  syncOptions() {
    const s = this.app.settings;
    this.el.optFov.value = s.fov; this.el.fovVal.textContent = s.fov;
    this.el.optSens.value = Math.round(s.sens * 100); this.el.sensVal.textContent = Math.round(s.sens * 100);
    this.el.optDist.value = s.renderDist; this.el.distVal.textContent = s.renderDist;
    this.el.optMute.checked = !!s.muted;
  }

  setProgress(p, text) {
    this.el.loadBar.style.width = Math.round(p * 100) + '%';
    if (text) this.el.loadText.textContent = text;
  }

  setDebug(text) {
    this.el.debug.textContent = text;
    this.el.debug.classList.toggle('visible', !!text);
  }

  setUnderwater(on) {
    this.el.underwater.classList.toggle('visible', on);
  }
};

})(typeof window !== 'undefined' ? window : globalThis);

