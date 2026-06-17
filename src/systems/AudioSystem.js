/**
 * 音频系统：使用 Web Audio API 合成简单音效。
 * 从 main.js 提取，提供 playSound(type) 接口。
 */
export class AudioSystem {
  constructor() {
    this.audioCtx = null;
  }

  ensure() {
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window['webkitAudioContext'])(); }
      catch (e) { this.audioCtx = null; }
    }
  }

  play(type) {
    this.ensure();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const presets = {
      plant:   { wave: 'triangle', f0: 220, f1: 440, dur: 0.12, vol: 0.15 },
      shoot:   { wave: 'square',   f0: 600, f1: 300, dur: 0.08, vol: 0.10 },
      bite:    { wave: 'sawtooth', f0: 150, f1: 90,  dur: 0.10, vol: 0.14 },
      die:     { wave: 'sawtooth', f0: 300, f1: 70,  dur: 0.30, vol: 0.16 },
      produce: { wave: 'sine',     f0: 500, f1: 900, dur: 0.15, vol: 0.12 },
      basehit: { wave: 'square',   f0: 110, f1: 70,  dur: 0.22, vol: 0.18 },
      // 僵尸生成音效：每种僵尸音色不同
      spawn_client:  { wave: 'triangle', f0: 180, f1: 320, dur: 0.18, vol: 0.12 }, // 甲方：轻快上扬
      spawn_kpi:     { wave: 'square',   f0: 100, f1: 250, dur: 0.22, vol: 0.14 }, // KPI：刺耳警报感
      spawn_boss:    { wave: 'sawtooth', f0: 55,  f1: 140, dur: 0.50, vol: 0.20 }, // 老板：低沉威压
      spawn_traitor: { wave: 'sawtooth', f0: 70,  f1: 180, dur: 0.40, vol: 0.18 }, // 工贼：阴森
    };
    const p = presets[type] || presets.shoot;
    osc.type = p.wave;
    osc.frequency.setValueAtTime(p.f0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, p.f1), now + p.dur);
    gain.gain.setValueAtTime(p.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
    osc.start(now);
    osc.stop(now + p.dur);
  }
}
