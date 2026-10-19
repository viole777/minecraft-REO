/* Mundo de Blocos - efeitos sonoros sintetizados (WebAudio, sem arquivos externos) */
;((g) => {
const VX = g.VX = g.VX || {};

let ctx = null, master = null, noiseBuf = null, volume = 0.6;

function ensure() {
  if (ctx) return true;
  try {
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  } catch (e) { return false; }
}

function burst(dur, freq, q, gain, rate) {
  if (!ensure() || ctx.state === 'suspended') { if (ctx) ctx.resume(); return; }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = rate || 1;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 1;
  const gn = ctx.createGain();
  const t = ctx.currentTime;
  gn.gain.setValueAtTime(gain, t);
  gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(gn); gn.connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
  src.stop(t + dur + 0.06);
}

VX.SFX = {
  step() { burst(0.06, 480, 0.8, 0.10, 0.9); },
  dig() { burst(0.12, 950, 1.2, 0.22, 1); },
  place() { burst(0.08, 1500, 1.4, 0.20, 1.1); },
  click() {
    if (!ensure() || ctx.state === 'suspended') { if (ctx) ctx.resume(); return; }
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(820, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.05);
    gn.gain.setValueAtTime(0.06, ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.connect(gn); gn.connect(master);
    o.start(); o.stop(ctx.currentTime + 0.07);
  },
  splash() { burst(0.25, 700, 0.6, 0.25, 0.7); },
  setVolume(v) { volume = v; if (master) master.gain.value = v; },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
};

})(typeof window !== 'undefined' ? window : globalThis);
