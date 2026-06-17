import './style.css';
import * as THREE from 'three';

import { GridSystem } from './systems/GridSystem.js';
import { ResourceSystem } from './systems/ResourceSystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { UIManager } from './ui/UIManager.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { EffectSystem } from './systems/EffectSystem.js';
import { InteractionSystem } from './systems/InteractionSystem.js';
import { createPlant, PLANT_TYPES } from './entities/Plant.js';
import { createZombie as makeZombie } from './entities/Zombie.js';
import { tweenManager } from './utils/Tween.js';
import { GridDebugger } from './utils/GridDebugger.js';

export const CFG = {
  ROWS: 9, COLS: 15, CELL: 3.00,
  START_RESOURCE: 50,
  BASE_HP: 100,
  GAME_DURATION: 300,
  RUSH_TIME: 45,
  PATROL_CHANCE: 0.15,
  PATROL_DURATION: 2,
  PATROL_PENALTY: 8,
};

/**
 * 游戏主类：初始化场景/相机/渲染器，整合各系统，驱动游戏循环。
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.running = false;
    this.clock = 0;
    this.lastT = 0;
    this.cfg = CFG;

    // 实体集合
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];

    // 子系统
    this.audio = new AudioSystem();
    this.particles = new ParticleSystem();
    this.effects = new EffectSystem();

    // buff 状态
    this._atkDebuffMul = 1;  this._atkDebuffEnd = 0;
    this._atkSpeedMul = 1;   this._atkSpeedEnd = 0;
    this._zombieSlowEnd = 0;

    // 卡片/技能状态
    this.cardCooldowns = {};
    this.selectedCard = null;
    this.hammerMode = false;
    this.patrolWarning = 0;
    this.shieldCount = 0;
    this.bossCount = 0;
    this.moyuMul = 1;

    // 波次
    this.wave = 0;
    this.waveTimer = 6;
    this.spawnQueue = [];

    this._initThree();
    this._initUI();
    this.interaction = new InteractionSystem(this);

    // 棋盘调试工具(默认隐藏，按H显示)
    this.debugger = new GridDebugger(this);

    this.ui.showOverlay(null);
    this.ui.onStart(() => this.start());

    this.lastT = performance.now();
    this._loop();
  }

  // ---------- Three.js 初始化 ----------
  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 60, 130);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 28, 35);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.add(new THREE.AmbientLight(0x606880, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(16, 28, 12);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -30; dir.shadow.camera.right = 30;
    dir.shadow.camera.top = 30; dir.shadow.camera.bottom = -30;
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xb0d8ff, 0x4a7a3a, 0.5));

    this.grid = new GridSystem(this.scene, CFG.ROWS, CFG.COLS, CFG.CELL);
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- UI 初始化 ----------
  _initUI() {
    const cards = ['sunflower', 'peashooter', 'wallnut', 'hammer', 'shield', 'heal', 'ult'].map(
      (t) => ({ type: t, ...PLANT_TYPES[t] })
    );
    this.ui = new UIManager(cards);
    this.ui.onCardClick = (type) => this._onCardClick(type);
  }

  /** 创建植物辅助(供 InteractionSystem 调用) */
  createPlant(type, row, col) {
    return createPlant(this.grid.group, type, row, col, this.grid);
  }

  /** 播放音效快捷方法 */
  playSound(type) { this.audio.play(type); }

  // ---------- 卡片点击 ----------
  _onCardClick(type) {
    if (!this.running) return;
    const cfg = PLANT_TYPES[type];

    if (cfg.isSkill) {
      if (this.clock < (this.cardCooldowns[type] || 0)) { this.ui.toast('技能冷却中…'); return; }
      if (type === 'hammer') { this._toggleHammer(); return; }
      if (type === 'shield') { this._useShield(cfg); return; }
      if (type === 'heal')   { this._useHeal(cfg); return; }
      if (type === 'ult')    { this._useUlt(cfg); return; }
      return;
    }

    // 植物卡片
    this.hammerMode = false;
    this.ui.setHammerMode(false);
    if (this.clock < (this.cardCooldowns[type] || 0)) { this.ui.toast('卡片冷却中…'); return; }
    if (!this.resource.canAfford(cfg.cost)) { this.ui.toast('摸鱼值不足！'); return; }
    this.ui.selectCard(type);
    this.selectedCard = type;
  }

  _toggleHammer() {
    const cfg = PLANT_TYPES.hammer;
    this.hammerMode = !this.hammerMode;
    if (this.hammerMode) {
      if (!this.resource.canAfford(cfg.cost)) { this.ui.toast('摸鱼值不足！'); this.hammerMode = false; return; }
      this.ui.selectCard('hammer');
      this.ui.setHammerMode(true);
      this.selectedCard = null;
      this.ui.toast('锤子已就绪！点牛头幽灵打断/点僵尸定身');
    } else {
      this.ui.clearSelection();
      this.ui.setHammerMode(false);
    }
  }

  _useShield(cfg) {
    if (!this.resource.canAfford(cfg.cost)) { this.ui.toast('摸鱼值不足！'); return; }
    this.resource.spend(cfg.cost);
    this.shieldCount = 5;
    this.cardCooldowns['shield'] = this.clock + cfg.cd;
    this.ui.setCardCooldown('shield', this.clock + cfg.cd);
    this.ui.setShield(this.shieldCount);
    this.ui.toast('🛡️ 工位护盾开启！抵挡接下来5次攻击');
    this.audio.play('plant');
  }

  _useHeal(cfg) {
    if (!this.resource.canAfford(cfg.cost)) { this.ui.toast('摸鱼值不足！'); return; }
    this.resource.spend(cfg.cost);
    this.cardCooldowns['heal'] = this.clock + cfg.cd;
    this.ui.setCardCooldown('heal', this.clock + cfg.cd);
    this.effects.healAllPlants(this, 0.2);
    this.ui.toast('💊 全员回血！所有植物恢复20%血量');
    this.audio.play('produce');
  }

  _useUlt(cfg) {
    this.cardCooldowns['ult'] = this.clock + cfg.cd;
    this.ui.setCardCooldown('ult', this.clock + cfg.cd);
    this.effects.ultShuaigu(this);
  }

  // ---------- 游戏开始/重置 ----------
  start() {
    this.audio.ensure();
    this._clearEntities();
    this.clock = 0;
    this.running = true;
    this.baseHp = CFG.BASE_HP;
    this.resource = new ResourceSystem(this.ui, CFG.START_RESOURCE);
    this.eventSystem = new EventSystem(this);
    this.ui.updateResource(CFG.START_RESOURCE);
    this.ui.updateBaseHp(1);
    this.ui.updateWave(0);
    this.ui.updateTimer(CFG.GAME_DURATION);
    this.ui.clearSelection();
    this.ui.setHammerMode(false);
    this.ui.setShield(0);
    this.ui.setBossDarken(false);
    this.selectedCard = null;
    this.hammerMode = false;
    this.cardCooldowns = {};
    this.ui.cardCooldowns = {};
    this.wave = 0;
    this.waveTimer = 6;
    this.spawnQueue = [];
    this.patrolWarning = 0;
    this.shieldCount = 0;
    this.bossCount = 0;
    this.moyuMul = 1;
    this.interaction.reset();
    this._atkDebuffMul = 1; this._atkDebuffEnd = 0;
    this._atkSpeedMul = 1;  this._atkSpeedEnd = 0;
    this._zombieSlowEnd = 0;
    this.ui.toast('开始搬砖！坚持5分钟到下班 💪');
  }

  _clearEntities() {
    for (const p of this.plants) p.destroy(this);
    for (const z of this.zombies) z.destroy(this);
    for (const pr of this.projectiles) pr.destroy();
    this.particles.clear(this.grid.group);
    this.effects.clear(this.grid.group);
    if (this.eventSystem) this.eventSystem.clearGhosts();
    this.plants = []; this.zombies = []; this.projectiles = [];
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        this.grid.setOccupied(r, c, null);
  }

  // ---------- 主循环 ----------
  _loop = () => {
    requestAnimationFrame(this._loop);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    dt = Math.min(dt, 0.05);

    if (this.running) this._update(dt);
    tweenManager.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  _update(dt) {
    this.clock += dt;

    if (this.patrolWarning > 0) {
      this.patrolWarning -= dt;
      if (this.patrolWarning <= 0) this.patrolWarning = 0;
    }

    const inRush = this.clock >= CFG.GAME_DURATION - CFG.RUSH_TIME;
    this.moyuMul = inRush ? 2 : 1;

    this.resource.update(dt);
    this._updateWaves(dt);
    this._updateSpawnQueue();

    const slowOn = this.clock < this._zombieSlowEnd;
    for (const z of this.zombies) {
      if (z.stunned > 0) continue;
      z.speed = z.baseSpeed * (slowOn ? 0.4 : 1);
    }

    this._refreshPlantBuffs();

    for (const p of this.plants) { if (!p.dead) p.update(dt, this); }
    for (const z of this.zombies) { if (!z.dead) z.update(dt, this); }

    this._updateProjectiles(dt);
    this._cleanup();
    this.particles.update(dt, this.grid.group);
    this.effects.update(dt, this.grid.group);

    this.eventSystem.updateGhosts(dt);
    this.eventSystem.update(dt, this.clock);

    this.ui.updateTimer(Math.max(0, CFG.GAME_DURATION - this.clock));
    this.ui.updateBaseHp(Math.max(0, this.baseHp / CFG.BASE_HP));
    this.ui.update(dt, this.clock);

    this._checkEnd();
  }

  _refreshPlantBuffs() {
    const atkDebuffMul = this.clock < this._atkDebuffEnd ? this._atkDebuffMul : 1;
    const speedMul = this.clock < this._atkSpeedEnd ? this._atkSpeedMul : 1;
    const bosses = this.zombies.filter((z) => z.type === 'boss' && !z.dead);
    for (const p of this.plants) {
      if (p.dead || p.frozen > 0) continue;
      let mul = atkDebuffMul;
      for (const b of bosses) {
        if (p.mesh.position.distanceTo(b.mesh.position) < 2.0) { mul *= 0.5; break; }
      }
      p.attackMul = mul;
      p.fireRateMul = speedMul;
    }
  }

  // ---------- 波次 ----------
  _updateWaves(dt) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.wave++;
      this.ui.updateWave(this.wave);
      this._spawnWave(this.wave);
      const inRush = this.clock >= CFG.GAME_DURATION - CFG.RUSH_TIME;
      this.waveTimer = inRush ? Math.max(6, 14 - this.wave * 0.8) : Math.max(12, 22 - this.wave * 1.5);
    }
  }

  _spawnWave(wave) {
    const inRush = this.clock >= CFG.GAME_DURATION - CFG.RUSH_TIME;
    let count = 2 + Math.floor(wave / 2);
    if (inRush) count = Math.floor(count * 1.8);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(Math.random() * CFG.ROWS);
      const type = this._pickZombieType(this.clock);
      this.spawnQueue.push({ type, row, at: this.clock + i * 1.2 });
    }
    this.ui.toast(inRush ? `🔥 下班高峰！第 ${wave} 波来活儿了！(${count} 个僵尸)` : `第 ${wave} 波来活儿了！(${count} 个僵尸)`);
  }

  _pickZombieType(elapsed) {
    const r = Math.random();
    if (elapsed < 30) return 'client';
    if (elapsed < 60) return r < 0.6 ? 'client' : 'kpi';
    return r < 0.4 ? 'client' : r < 0.75 ? 'kpi' : 'boss';
  }

  _updateSpawnQueue() {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      if (this.clock >= s.at) {
        const z = makeZombie(this.grid.group, s.type, s.row, this.grid);
        this.zombies.push(z);
        this.spawnQueue.splice(i, 1);
      }
    }
  }

  // ---------- 弹丸 ----------
  _updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.update(dt);
      for (const z of this.zombies) {
        if (z.dead || z.row !== pr.row) continue;
        const hitRadius = pr.big ? 0.8 : 0.55;
        if (Math.abs(z.mesh.position.x - pr.mesh.position.x) < hitRadius) {
          z.takeDamage(pr.damage);
          pr.destroy();
          break;
        }
      }
      if (!pr.dead && (pr.mesh.position.x < this.grid.getSpawnX() - 4 || pr.mesh.position.x > this.grid.getBaseX() + 4)) pr.destroy();
    }
  }

  _cleanup() {
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      if (p.dead) {
        this.grid.setOccupied(p.row, p.col, null);
        p.destroy(this);
        this.plants.splice(i, 1);
      }
    }
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead) { z.destroy(this); this.zombies.splice(i, 1); }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  // ---------- 查询辅助(供 Plant/Zombie 调用) ----------
  hasZombieAhead(row, plantX) {
    for (const z of this.zombies) {
      if (z.dead || z.row !== row) continue;
      const zx = z.mesh.position.x;
      if (zx < plantX + 0.3 && zx > plantX - 14) return true;
    }
    return false;
  }

  getPlantBlocking(row, zombieX) {
    let best = null, bestDx = Infinity;
    for (const p of this.plants) {
      if (p.dead || p.row !== row) continue;
      const dx = p.mesh.position.x - zombieX;
      if (dx > -0.1 && dx <= 0.7 && dx < bestDx) { best = p; bestDx = dx; }
    }
    return best;
  }

  // ---------- 基地/资源辅助(供 EventSystem 调用) ----------
  damageBase(amount) {
    if (this.shieldCount > 0) {
      this.shieldCount--;
      this.ui.setShield(this.shieldCount);
      this.ui.toast('🛡️ 护盾抵挡一次攻击！(剩余' + this.shieldCount + ')');
      this.audio.play('plant');
      return;
    }
    this.baseHp = Math.max(0, this.baseHp - amount);
  }
  healBase(amount) { this.baseHp = Math.min(CFG.BASE_HP, this.baseHp + amount); }
  spendOrForce(amount) {
    if (this.resource.canAfford(amount)) this.resource.spend(amount);
    else this.resource.value -= amount;
  }
  buffAttackSpeed(mul, dur) { this._atkSpeedMul = mul; this._atkSpeedEnd = this.clock + dur; }
  buffAttackMul(mul, dur) { this._atkDebuffMul = mul; this._atkDebuffEnd = this.clock + dur; }
  slowAllZombies(dur) { this._zombieSlowEnd = this.clock + dur; }

  killWeakestZombies(n) {
    const alive = this.zombies.filter((z) => !z.dead).sort((a, b) => a.hp - b.hp);
    for (let i = 0; i < Math.min(n, alive.length); i++) {
      alive[i].dead = true;
      this.particles.spawnDeath(this.grid.group, alive[i].mesh.position.clone());
    }
  }

  spawnFreePlant(type) {
    const empties = [];
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        if (!this.grid.isOccupied(r, c)) empties.push({ r, c });
    if (empties.length === 0) { this.ui.toast('没有空位种了！'); return; }
    const { r, c } = empties[Math.floor(Math.random() * empties.length)];
    const plant = this.createPlant(type, r, c);
    this.plants.push(plant);
    this.grid.setOccupied(r, c, plant);
    this.particles.spawnPlant(this.grid.group, this.grid.gridToWorld(r, c));
    this.audio.play('plant');
  }

  freezeRandomPlant(dur) {
    const alive = this.plants.filter((p) => !p.dead && p.frozen <= 0);
    if (alive.length === 0) return;
    alive[Math.floor(Math.random() * alive.length)].frozen = dur;
  }

  removeRandomPlant() {
    const alive = this.plants.filter((p) => !p.dead);
    if (alive.length === 0) return;
    alive[Math.floor(Math.random() * alive.length)].dead = true;
  }

  toast(msg) { this.ui.toast(msg); }

  // ---------- Boss 回调 ----------
  onBossSpawn() {
    this.bossCount++;
    if (this.bossCount === 1) {
      this.ui.setBossDarken(true);
      this.ui.toast('👑 大老板驾到！全场变暗，植物瑟瑟发抖…');
      this.audio.play('basehit');
    }
  }

  onBossDie() {
    this.bossCount = Math.max(0, this.bossCount - 1);
    if (this.bossCount === 0) this.ui.setBossDarken(false);
  }

  onBossKilled() {
    const drop = 200;
    this.resource.add(drop);
    const pos = this.zombies.length > 0 ? this.zombies[this.zombies.length - 1].mesh.position.clone() : new THREE.Vector3(0, 1, 0);
    this.effects.spawnFloatText(this.grid.group, pos, '+' + drop + ' 🐟', '#ffd34d');
    this.ui.toast('🎉 击杀大老板！掉落' + drop + '摸鱼值！');
  }

  // ---------- 胜负 ----------
  _checkEnd() {
    if (!this.running) return;
    if (this.baseHp <= 0) { this._end(false); return; }
    if (this.resource.get() < 0) { this._end(false); return; }
    if (this.clock >= CFG.GAME_DURATION) { this._end(true); return; }
  }

  _end(win) {
    this.running = false;
    this.ui.clearSelection();
    this.ui.setHammerMode(false);
    this.ui.setBossDarken(false);
    this.hammerMode = false;
    this.ui.showOverlay(win ? 'win' : 'lose');
    if (this.eventSystem) this.eventSystem.clearGhosts();
  }
}

// 启动
new Game();
