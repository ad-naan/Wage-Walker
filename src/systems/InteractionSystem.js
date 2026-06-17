import * as THREE from 'three';
import { PLANT_TYPES } from '../entities/Plant.js';

/**
 * 交互系统：处理鼠标点击(锤子/种植/点击植物)、蓄力释放等。
 * 从 main.js 提取，通过 game 引用访问游戏状态。
 */
export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this._chargePlant = null;
    this._chargeStart = 0;

    game.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    game.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));

    // 拖拽放置植物：卡片拖到 canvas 上释放
    game.canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    game.canvas.addEventListener('drop', (e) => this._onDrop(e));
  }

  /** 拖放植物到格子上 */
  _onDrop(e) {
    e.preventDefault();
    const g = this.game;
    if (!g.running) return;
    const type = e.dataTransfer.getData('text/plain') || g.ui._dragType;
    if (!type) return;
    const cfg = PLANT_TYPES[type];
    if (!cfg || cfg.isSkill || cfg.isUlt || cfg.isTicket) return; // 非植物卡片不处理
    // 检查冷却和费用
    if (g.clock < (g.cardCooldowns[type] || 0)) { g.ui.toast('卡片冷却中…'); return; }
    const cost = g.items.isUltMoyu() ? 0 : cfg.cost;
    if (cost > 0 && !g.resource.canAfford(cost)) { g.ui.toast('摸鱼值不足！'); return; }
    // 计算鼠标对应的格子
    this._setMouse(e);
    const hits = this.raycaster.intersectObjects(g.grid.getTileMeshes());
    if (hits.length === 0) return;
    const tile = hits[0].object;
    const { row, col } = tile.userData;
    // 直接种植
    g.selectedCard = type;
    this._tryPlant(row, col);
    g.ui._dragType = null;
  }

  _setMouse(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.game.camera);
  }

  _onPointerDown(e) {
    const g = this.game;
    if (!g.running) return;
    this._setMouse(e);

    // ===== 种植模式：点击地块放置 =====
    if (g.selectedCard) {
      const hits = this.raycaster.intersectObjects(g.grid.getTileMeshes());
      if (hits.length === 0) return;
      const tile = hits[0].object;
      const { row, col } = tile.userData;
      this._tryPlant(row, col);
      return;
    }

    // ===== 无选中模式：点击植物(向日葵产出/坚果墙彩蛋/豌豆射手蓄力) =====
    const plantMeshes = g.plants.filter((p) => !p.dead).map((p) => p.mesh);
    const hits = this.raycaster.intersectObjects(plantMeshes, true);
    if (hits.length > 0) {
      const plant = this._findEntityFromObject(hits[0].object, g.plants, 'plant');
      if (plant) { this._onPlantClick(plant); return; }
    }

    // ===== 点击牛头幽灵(锤子自动触发) =====
    const ghosts = g.eventSystem.getGhosts();
    if (ghosts.length > 0) {
      const ghostMeshes = ghosts.map((gh) => gh.mesh);
      const ghostHits = this.raycaster.intersectObjects(ghostMeshes, true);
      if (ghostHits.length > 0) {
        const ghost = this._findGhostFromObject(ghostHits[0].object, ghosts);
        if (ghost) { g.eventSystem.smashGhost(ghost); return; }
      }
    }
  }

  _onPointerUp() {
    if (this._chargePlant) {
      const chargeTime = (performance.now() - this._chargeStart) / 1000;
      const plant = this._chargePlant;
      this._chargePlant = null;
      plant.chargeShoot(this.game, chargeTime);
    }
  }

  _onPlantClick(plant) {
    const g = this.game;
    if (plant.type === 'sunflower') {
      this._onSunflowerClick(plant);
    } else if (plant.type === 'wallnut') {
      plant.onEggClick(g);
    } else if (plant.type === 'peashooter') {
      this._chargePlant = plant;
      this._chargeStart = performance.now();
      plant.startCharge(g);
      plant.onEggClick(g);
    }
  }

  /** 向日葵点击：产出摸鱼值，有概率触发老板路过警告 */
  _onSunflowerClick(plant) {
    const g = this.game;
    const CFG = g.cfg;
    if (g.patrolWarning > 0) {
      g.damageBase(CFG.PATROL_PENALTY);
      g.ui.toast('⚠️ 老板还在路过！工位血量-' + CFG.PATROL_PENALTY);
      g.ui.flashRed();
      g.patrolWarning = CFG.PATROL_DURATION;
      const p = plant.mesh.position.clone(); p.y += 1.4;
      g.effects.spawnFloatText(g.grid.group, p, '-' + CFG.PATROL_PENALTY, '#ff3333');
      g.audio.play('basehit');
      return;
    }
    plant.onClick(g);
    if (Math.random() < CFG.PATROL_CHANCE) {
      g.patrolWarning = CFG.PATROL_DURATION;
      g.ui.toast('🚨 老板路过！2秒内别再点向日葵！');
      g.ui.flashRed();
    }
  }

  _tryPlant(row, col) {
    const g = this.game;
    const type = g.selectedCard;
    if (!type) return;
    if (g.grid.isOccupied(row, col)) { g.ui.toast('这里已经有植物了'); return; }
    const cfg = PLANT_TYPES[type];
    if (g.clock < (g.cardCooldowns[type] || 0)) { g.ui.toast('卡片冷却中…'); return; }
    const cost = g.items.isUltMoyu() ? 0 : cfg.cost;
    if (cost > 0 && !g.resource.canAfford(cost)) { g.ui.toast('摸鱼值不足！'); return; }
    if (cost > 0) g.resource.spend(cost);
    const plant = g.createPlant(type, row, col);
    g.plants.push(plant);
    g.grid.setOccupied(row, col, plant);
    g._setCD(type, cfg.cd);
    g.particles.spawnPlant(g.grid.group, g.grid.gridToWorld(row, col));
    g.audio.play('plant');
    g.ui.clearSelection();
    g.selectedCard = null;
  }

  _findGhostFromObject(obj, ghosts) {
    let cur = obj;
    while (cur && !cur.userData.isGhost) cur = cur.parent;
    return ghosts.find((g) => g.mesh === cur) || null;
  }

  _findEntityFromObject(obj, list, key) {
    let cur = obj;
    while (cur && !cur.userData[key]) cur = cur.parent;
    if (!cur) return null;
    return cur.userData[key] || null;
  }

  /** 重置蓄力状态(新一局开始时调用) */
  reset() {
    this._chargePlant = null;
  }
}
