/**
 * 棋盘调试工具
 * 用途：游戏中按键盘实时调整棋盘位置、格子大小、相机视角，
 *       找到满意位置后按 P 打印最终参数到控制台，供开发者复制到代码。
 *
 * 快捷键：
 *   H             : 显示/隐藏调试面板 (默认隐藏)
 *   方向键        : 平移棋盘 (←→ X轴, ↑↓ Z轴)  —— ↑屏幕向上(远处), ↓屏幕向下(近处)
 *   W / S         : 棋盘 Y 轴上下移动 (W升起/S下沉)
 *   Q / E         : 棋盘缩放 (Q放大格子,E缩小格子)
 *   A / D         : 相机左右平移
 *   R / F         : 相机上下移动 (R升高/F降低)
 *   Z / X         : 相机前后移动 (Z拉近/X拉远)
 *   C / V         : 相机 FOV 调整 (C缩小视角放大画面/V扩大视角缩小画面)
 *   + / - (或 [/]) : 步长调整 (默认0.5)
 *   P             : 打印最终参数到控制台 (CTRL+C 复制)
 *
 * 用法：在 main.js 的 Game 构造函数末尾添加:
 *   import { GridDebugger } from './utils/GridDebugger.js';
 *   new GridDebugger(this);
 */
export class GridDebugger {
  constructor(game) {
    this.game = game;
    this.step = 0.5;       // 移动步长
    this.showHelp = false; // 默认隐藏
    this._buildHelpPanel();
    this._bindKeys();
    console.log('%c[GridDebugger] 已启用(默认隐藏)。按 H 显示调试面板。', 'color:#4af');
  }

  _buildHelpPanel() {
    const root = document.getElementById('ui-root');
    const panel = document.createElement('div');
    panel.id = 'debug-help';
    panel.style.display = 'none'; // 默认隐藏
    panel.innerHTML = `
      <div class="dh-title">🔧 棋盘调试工具 <span class="dh-close" id="dh-close">×</span></div>
      <div class="dh-section"><b>棋盘平移</b>
        <div>← → : X 轴左右 &nbsp; ↑ ↓ : Z 轴上下</div>
        <div>W / S : Y 轴升降</div>
        <div>Q / E : 格子缩放</div>
      </div>
      <div class="dh-section"><b>相机调整</b>
        <div>A / D : 左右平移 &nbsp; R / F : 高低</div>
        <div>Z / X : 前后推拉 &nbsp; C / V : FOV(画面大小)</div>
      </div>
      <div class="dh-section"><b>其他</b>
        <div>+ / - : 步长调整 (当前 <span id="dh-step">0.5</span>)</div>
        <div>P : 打印参数 &nbsp; H : 隐藏/显示此面板</div>
      </div>
      <div class="dh-readout" id="dh-readout"></div>`;
    root.appendChild(panel);
    this.panel = panel;
    this.readout = panel.querySelector('#dh-readout');
    this.stepEl = panel.querySelector('#dh-step');
    // 关闭按钮
    panel.querySelector('#dh-close').addEventListener('click', () => this._toggleHelp(false));
    this._updateReadout();
  }

  _toggleHelp(forceState) {
    this.showHelp = forceState != null ? forceState : !this.showHelp;
    this.panel.style.display = this.showHelp ? 'block' : 'none';
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      // 忽略输入框
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const g = this.game;
      const grid = g.grid.group;
      const cam = g.camera;
      const s = this.step;
      let handled = true;

      switch (e.key) {
        // 棋盘平移
        case 'ArrowLeft':  grid.position.x -= s; break;
        case 'ArrowRight': grid.position.x += s; break;
        case 'ArrowUp':    grid.position.z -= s; break;  // 屏幕向上=远处
        case 'ArrowDown':  grid.position.z += s; break;  // 屏幕向下=近处
        case 'w': case 'W': grid.position.y += s; break;
        case 's': case 'S': grid.position.y -= s; break;
        // 格子缩放(重新构建网格)
        case 'q': case 'Q': this._rescaleCell(g.cfg.CELL + s * 0.2); break;
        case 'e': case 'E': this._rescaleCell(g.cfg.CELL - s * 0.2); break;
        // 相机左右
        case 'a': case 'A': cam.position.x -= s; break;
        case 'd': case 'D': cam.position.x += s; break;
        // 相机高低
        case 'r': case 'R': cam.position.y += s; break;
        case 'f': case 'F': cam.position.y -= s; break;
        // 相机前后(沿观察方向近似)
        case 'z': case 'Z':
          cam.position.x += s * 0.6; cam.position.z -= s * 0.8; break;
        case 'x': case 'X':
          cam.position.x -= s * 0.6; cam.position.z += s * 0.8; break;
        // FOV
        case 'c': case 'C': cam.fov = Math.max(20, cam.fov - 1); cam.updateProjectionMatrix(); break;
        case 'v': case 'V': cam.fov = Math.min(90, cam.fov + 1); cam.updateProjectionMatrix(); break;
        // 步长
        case '+': case '=': this.step = Math.min(5, this.step + 0.25); this.stepEl.textContent = this.step; break;
        case '-': case '_': this.step = Math.max(0.1, this.step - 0.25); this.stepEl.textContent = this.step; break;
        // 打印参数
        case 'p': case 'P': this._printConfig(); break;
        // 帮助(默认隐藏，按H切换)
        case 'h': case 'H': this._toggleHelp(); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._updateReadout();
      }
    });
  }

  /** 调整格子尺寸(需要重建网格) */
  _rescaleCell(newCell) {
    const g = this.game;
    newCell = Math.max(1.5, Math.min(4, newCell));
    if (Math.abs(newCell - g.cfg.CELL) < 0.05) return;
    g.cfg.CELL = newCell;
    // 记住当前偏移
    const offset = g.grid.group.position.clone();
    // 重建网格
    g.scene.remove(g.grid.group);
    g.grid = new (g.grid.constructor)(g.scene, g.cfg.ROWS, g.cfg.COLS, g.cfg.CELL);
    g.grid.group.position.copy(offset);
  }

  _updateReadout() {
    const g = this.game;
    const grid = g.grid.group.position;
    const cam = g.camera.position;
    this.readout.innerHTML =
      `<div>棋盘: pos(${grid.x.toFixed(1)}, ${grid.y.toFixed(1)}, ${grid.z.toFixed(1)}) cell=${g.cfg.CELL.toFixed(2)}</div>` +
      `<div>相机: pos(${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)}) fov=${g.camera.fov.toFixed(0)}°</div>`;
  }

  /** 打印可直接粘贴到 main.js 的配置 */
  _printConfig() {
    const g = this.game;
    const grid = g.grid.group.position;
    const cam = g.camera.position;
    const cfg = `===== 复制以下参数到代码 =====
// main.js CFG
const CFG = {
  ROWS: ${g.cfg.ROWS}, COLS: ${g.cfg.COLS}, CELL: ${g.cfg.CELL.toFixed(2)},
  ...
};

// main.js _initThree 相机部分
this.scene.fog = new THREE.Fog(0x87CEEB, ${g.scene.fog.near}, ${g.scene.fog.far});
this.camera = new THREE.PerspectiveCamera(${g.camera.fov.toFixed(0)}, window.innerWidth / window.innerHeight, 0.1, 200);
this.camera.position.set(${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}, ${cam.z.toFixed(1)});
this.camera.lookAt(${grid.x.toFixed(1)}, ${grid.y.toFixed(1)}, ${grid.z.toFixed(1)});

// GridSystem.js constructor 中 group 偏移
this.group.position.set(${grid.x.toFixed(1)}, ${grid.y.toFixed(1)}, ${grid.z.toFixed(1)});
===== 复制结束 =====`;
    console.log('%c' + cfg, 'color:#4f4;background:#022;padding:8px');
    this.game.ui.toast('参数已打印到控制台(F12查看)，可直接复制');
  }
}
