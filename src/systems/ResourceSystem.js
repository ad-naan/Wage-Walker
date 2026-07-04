/**
 * 资源系统：管理"摸鱼值"的增减与 UI 显示(带缓动)。
 * 初始 50 点。向日葵社畜每 5 秒生产 25 点。
 */
export class ResourceSystem {
  constructor(ui, start = 50) {
    this.ui = ui;
    this.value = start;
    this.displayValue = start;
    this._passiveTimer = 0;
    this._passiveInterval = 8; // 每8秒被动产出5摸鱼值(防止完全卡死)
  }

  reset(start = 50) {
    this.value = start;
    this.displayValue = start;
    this._passiveTimer = 0;
  }

  add(amount) {
    this.value += amount;
  }

  canAfford(amount) {
    return this.value >= amount;
  }

  spend(amount) {
    if (this.value < amount) return false;
    this.value -= amount;
    return true;
  }

  get() {
    return this.value;
  }

  update(dt) {
    // 被动微量产出(防止资源枯竭卡死)
    this._passiveTimer += dt;
    if (this._passiveTimer >= this._passiveInterval) {
      this._passiveTimer = 0;
      this.value += 5;
    }
    // displayValue 缓动追随 value
    const diff = this.value - this.displayValue;
    if (Math.abs(diff) < 0.5) {
      this.displayValue = this.value;
    } else {
      this.displayValue += diff * Math.min(1, dt * 8);
    }
    this.ui.updateResource(Math.round(this.displayValue));
  }
}
