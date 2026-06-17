/**
 * 资源系统：管理"摸鱼值"的增减与 UI 显示(带缓动)。
 * 初始 50 点。向日葵社畜每 5 秒生产 25 点。
 */
export class ResourceSystem {
  constructor(ui, start = 50) {
    this.ui = ui;
    this.value = start;
    this.displayValue = start;
  }

  reset(start = 50) {
    this.value = start;
    this.displayValue = start;
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
