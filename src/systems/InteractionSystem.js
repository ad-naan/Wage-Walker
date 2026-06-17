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

    // ===== 锤子模式：优先敲牛头幽灵，其次敲僵尸 =====
    if (g.hammerMode) {
      const ghosts = g.eventSystem.getGhosts();
      const ghostMeshes = ghosts.map((gh) => gh.mesh);
      let hits = this.raycaster.intersectObjects(ghostMeshes, true);
      if (hits.length > 0) {
        const ghost = this._findGhostFromObject(hits[0].object, ghosts);
        if (ghost) { g.eventSystem.smashGhost(ghost); return; }
      }
      const zombieMeshes = g.zombies.filter((z) => !z.dead).map((z) => z.mesh);
      hits = this.raycaster.intersectObjects(zombieMeshes, true);
      if (hits.length > 0) {
        const zombie = this._findEntityFromObject(hits[0].object, g.zombies, 'zombie');
        if (zombie) { this._smashZombie(zombie); return; }
      }
      g.ui.toast('锤子只能敲场上的牛头幽灵或僵尸');
      return;
    }

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

  /** 锤子砸僵尸：定身3秒 + 受到伤害翻倍 */
  _smashZombie(zombie) {
    const g = this.game;
    if (!g.resource.canAfford(PLANT_TYPES.hammer.cost)) {
      g.ui.toast('摸鱼值不足！需要' + PLANT_TYPES.hammer.cost + '🐟');
      return;
    }
    zombie.stunned = 3;
    zombie.doubleDamage = true;
    g.cardCooldowns['hammer'] = g.clock + PLANT_TYPES.hammer.cd;
    g.ui.setCardCooldown('hammer', g.clock + PLANT_TYPES.hammer.cd);
    g.resource.spend(PLANT_TYPES.hammer.cost);
    const p = zombie.mesh.position.clone(); p.y += 1.8;
    g.effects.spawnFloatText(g.grid.group, p, '改PPT！', '#ff8800');
    g.ui.toast('🔨 僵尸被强制改PPT 3秒，受伤翻倍！');
    g.audio.play('plant');
    g.hammerMode = false;
    g.ui.setHammerMode(false);
    g.ui.clearSelection();
  }

  _tryPlant(row, col) {
    const g = this.game;
    const type = g.selectedCard;
    if (!type) return;
    if (g.grid.isOccupied(row, col)) { g.ui.toast('这里已经有植物了'); return; }
    const cfg = PLANT_TYPES[type];
    if (g.clock < (g.cardCooldowns[type] || 0)) { g.ui.toast('卡片冷却中…'); return; }
    if (!g.resource.canAfford(cfg.cost)) { g.ui.toast('摸鱼值不足！'); return; }

    g.resource.spend(cfg.cost);
    const plant = g.createPlant(type, row, col);
    g.plants.push(plant);
    g.grid.setOccupied(row, col, plant);
    g.cardCooldowns[type] = g.clock + cfg.cd;
    g.ui.setCardCooldown(type, g.clock + cfg.cd);
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
