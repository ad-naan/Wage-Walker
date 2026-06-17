// 简单补间工具：管理数值属性的缓动插值
export const Easing = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInQuad: (t) => t * t,
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export class TweenManager {
  constructor() {
    this.active = [];
  }

  /**
   * 对 obj 的数值属性进行补间到 target
   * @param {object} obj 目标对象
   * @param {object} target 目标属性 {key: value}
   * @param {number} duration 持续时间(秒)
   * @param {function} easing 缓动函数
   * @param {function} onComplete 完成回调
   */
  to(obj, target, duration = 0.5, easing = Easing.easeOutCubic, onComplete = null) {
    const startVals = {};
    for (const k in target) startVals[k] = obj[k];
    const tween = { obj, target, startVals, duration, elapsed: 0, easing, onComplete, dead: false };
    this.active.push(tween);
    return tween;
  }

  killFor(obj) {
    for (const t of this.active) if (t.obj === obj) t.dead = true;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      if (t.dead) { this.active.splice(i, 1); continue; }
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const e = t.easing(p);
      for (const k in t.target) {
        t.obj[k] = t.startVals[k] + (t.target[k] - t.startVals[k]) * e;
      }
      if (p >= 1) {
        this.active.splice(i, 1);
        if (t.onComplete) t.onComplete();
      }
    }
  }

  clear() {
    this.active.length = 0;
  }
}

export const tweenManager = new TweenManager();
