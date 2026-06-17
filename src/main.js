import './style.css';
import * as THREE from 'three';

import { GridSystem } from './systems/GridSystem.js';
import { ResourceSystem } from './systems/ResourceSystem.js';
import { EventSystem } from './systems/EventSystem.js';
import { UIManager } from './ui/UIManager.js';
import { createPlant, PLANT_TYPES } from './entities/Plant.js';
import { createZombie as makeZombie } from './entities/Zombie.js';
import { tweenManager } from './utils/Tween.js';

const CFG = {
  ROWS: 5, COLS: 9, CELL: 2,
  START_RESOURCE: 50,
  BASE_HP: 100,
  GAME_DURATION: 300, // 5 分钟
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

    // 实体集合
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatTexts = [];

    // buff 状态(由牛头事件驱动)
    this._atkDebuffMul = 1;  this._atkDebuffEnd = 0;
    this._atkSpeedMul = 1;   this._atkSpeedEnd = 0;
    this._zombieSlowEnd = 0;

    // 卡片冷却 {type: endTime}
    this.cardCooldowns = {};
    this.selectedCard = null;
    this.hammerMode = false;

    // 波次
    this.wave = 0;
    this.waveTimer = 6;
    this.spawnQueue = [];

    this._initThree();
    this._initUI();
    this._initInteraction();
    this._initAudio();

    // 初始展示开始画面
    this.ui.showOverlay(null);
    this.ui.onStart(() => this.start());

    // 启动渲染循环(即使未开始也渲染场景)
    this.lastT = performance.now();
    this._loop();
  }

  // ---------- Three.js 初始化 ----------
  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 32, 75);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(14, 20, 15);
    this.camera.lookAt(2, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 光照
    this.scene.add(new THREE.AmbientLight(0x606880, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(12, 24, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -20; dir.shadow.camera.right = 20;
    dir.shadow.camera.top = 20; dir.shadow.camera.bottom = -20;
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xb0d8ff, 0x4a7a3a, 0.5));

    // 网格
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
    const cards = ['sunflower', 'peashooter', 'wallnut', 'hammer'].map(
      (t) => ({ type: t, ...PLANT_TYPES[t] })
    );
    this.ui = new UIManager(cards);
    this.ui.onCardClick = (type) => this._onCardClick(type);
  }

  // ---------- 交互 ----------
  _initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
  }

  _onPointerDown(e) {
    if (!this.running) return;
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 锤子模式：优先敲牛头幽灵
    if (this.hammerMode) {
      const ghosts = this.eventSystem.getGhosts();
      const meshes = ghosts.map((g) => g.mesh);
      const hits = this.raycaster.intersectObjects(meshes, true);
      if (hits.length > 0) {
        const ghost = this._findGhostFromObject(hits[0].object, ghosts);
        if (ghost) { this.eventSystem.smashGhost(ghost); return; }
      }
      this.ui.toast('锤子只能敲场上的牛头幽灵');
      return;
    }

    // 种植模式：点击地块放置
    if (this.selectedCard) {
      const hits = this.raycaster.intersectObjects(this.grid.getTileMeshes());
      if (hits.length === 0) return;
      const tile = hits[0].object;
      const { row, col } = tile.userData;
      this._tryPlant(row, col);
    }
  }

  _findGhostFromObject(obj, ghosts) {
    let cur = obj;
    while (cur && !cur.userData.isGhost) cur = cur.parent;
    return ghosts.find((g) => g.mesh === cur) || null;
  }

  _onCardClick(type) {
    if (!this.running) return;
    const cfg = PLANT_TYPES[type];
    if (type === 'hammer') {
      this.hammerMode = !this.hammerMode;
      if (this.hammerMode) {
        this.ui.selectCard('hammer');
        this.ui.setHammerMode(true);
        this.selectedCard = null;
        this.ui.toast('锤子已就绪！点击牛头幽灵打断干扰');
      } else {
        this.ui.clearSelection();
        this.ui.setHammerMode(false);
      }
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

  _tryPlant(row, col) {
    const type = this.selectedCard;
    if (!type) return;
    if (this.grid.isOccupied(row, col)) { this.ui.toast('这里已经有植物了'); return; }
    const cfg = PLANT_TYPES[type];
    if (this.clock < (this.cardCooldowns[type] || 0)) { this.ui.toast('卡片冷却中…'); return; }
    if (!this.resource.canAfford(cfg.cost)) { this.ui.toast('摸鱼值不足！'); return; }

    this.resource.spend(cfg.cost);
    const plant = createPlant(this.scene, type, row, col, this.grid);
    this.plants.push(plant);
    this.grid.setOccupied(row, col, plant);
    this.cardCooldowns[type] = this.clock + cfg.cd;
    this.ui.setCardCooldown(type, this.clock + cfg.cd);
    this._spawnPlantParticles(this.grid.gridToWorld(row, col));
    this.playSound('plant');
    this.ui.clearSelection();
    this.selectedCard = null;
  }

  // ---------- 音频(Web Audio 合成) ----------
  _initAudio() {
    this.audioCtx = null;
  }

  _ensureAudio() {
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window['webkitAudioContext'])(); }
      catch (e) { this.audioCtx = null; }
    }
  }

  playSound(type) {
    this._ensureAudio();
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

  // ---------- 游戏开始/重置 ----------
  start() {
    this._ensureAudio();
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
    this.selectedCard = null;
    this.hammerMode = false;
    this.cardCooldowns = {};
    this.wave = 0;
    this.waveTimer = 6;
    this.spawnQueue = [];
    this._atkDebuffMul = 1; this._atkDebuffEnd = 0;
    this._atkSpeedMul = 1;  this._atkSpeedEnd = 0;
    this._zombieSlowEnd = 0;
    this.ui.toast('开始搬砖！坚持5分钟到下班 💪');
  }

  _clearEntities() {
    for (const p of this.plants) p.destroy(this);
    for (const z of this.zombies) z.destroy(this);
    for (const pr of this.projectiles) pr.destroy();
    for (const pt of this.particles) this.scene.remove(pt.points);
    for (const ft of this.floatTexts) this.scene.remove(ft.sprite);
    if (this.eventSystem) this.eventSystem.clearGhosts();
    this.plants = []; this.zombies = []; this.projectiles = [];
    this.particles = []; this.floatTexts = [];
    // 清空网格占用
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

    // 资源 UI
    this.resource.update(dt);

    // 波次生成
    this._updateWaves(dt);

    // 处理生成队列
    this._updateSpawnQueue();

    // 僵尸减速 buff
    const slowOn = this.clock < this._zombieSlowEnd;
    for (const z of this.zombies) z.speed = z.baseSpeed * (slowOn ? 0.4 : 1);

    // 刷新植物 buff(攻击力/攻速，含老板光环)
    this._refreshPlantBuffs();

    // 更新植物
    for (const p of this.plants) {
      if (!p.dead) p.update(dt, this);
    }

    // 更新僵尸
    for (const z of this.zombies) {
      if (!z.dead) z.update(dt, this);
    }

    // 更新弹丸 + 碰撞
    this._updateProjectiles(dt);

    // 清理死亡实体
    this._cleanup();

    // 粒子 / 浮动文字
    this._updateParticles(dt);
    this._updateFloatTexts(dt);

    // 牛头事件
    this.eventSystem.updateGhosts(dt);
    this.eventSystem.update(dt, this.clock);

    // UI 倒计时与冷却
    this.ui.updateTimer(Math.max(0, CFG.GAME_DURATION - this.clock));
    this.ui.updateBaseHp(Math.max(0, this.baseHp / CFG.BASE_HP));
    this.ui.update(dt, this.clock);

    // 胜负判定
    this._checkEnd();
  }

  _refreshPlantBuffs() {
    const atkDebuffOn = this.clock < this._atkDebuffEnd;
    const atkDebuffMul = atkDebuffOn ? this._atkDebuffMul : 1;
    const speedOn = this.clock < this._atkSpeedEnd;
    const speedMul = speedOn ? this._atkSpeedMul : 1;
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
      this.waveTimer = Math.max(12, 22 - this.wave * 1.5);
    }
  }

  _spawnWave(wave) {
    const count = 2 + Math.floor(wave / 2);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(Math.random() * CFG.ROWS);
      const type = this._pickZombieType(wave);
      this.spawnQueue.push({ type, row, at: this.clock + i * 1.4 });
    }
    this.ui.toast(`第 ${wave} 波来活儿了！(${count} 个僵尸)`);
  }

  _pickZombieType(wave) {
    const r = Math.random();
    if (wave < 3) return 'client';
    if (wave < 6) return r < 0.6 ? 'client' : 'kpi';
    return r < 0.4 ? 'client' : r < 0.7 ? 'kpi' : 'boss';
  }

  _updateSpawnQueue() {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      if (this.clock >= s.at) {
        const z = makeZombie(this.scene, s.type, s.row, this.grid);
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
      // 命中检测
      for (const z of this.zombies) {
        if (z.dead || z.row !== pr.row) continue;
        if (Math.abs(z.mesh.position.x - pr.mesh.position.x) < 0.55) {
          z.takeDamage(pr.damage);
          pr.destroy();
          break;
        }
      }
      // 飞出界(左/右)
      if (!pr.dead && (pr.mesh.position.x < this.grid.getSpawnX() - 4 || pr.mesh.position.x > this.grid.getBaseX() + 4)) pr.destroy();
    }
  }

  _cleanup() {
    // 植物
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      if (p.dead) {
        this.grid.setOccupied(p.row, p.col, null);
        p.destroy(this);
        this.plants.splice(i, 1);
      }
    }
    // 僵尸
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead) { z.destroy(this); this.zombies.splice(i, 1); }
    }
    // 弹丸
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  // ---------- 粒子 ----------
  _spawnPlantParticles(pos) {
    // 绿色圆环扩散
    const N = 24;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = 0.3;
      positions[i * 3 + 2] = pos.z;
      const a = (i / N) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 0.8;
      velocities.push(new THREE.Vector3(Math.cos(a) * sp, 1.2 + Math.random(), Math.sin(a) * sp));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x6fff5a, size: 0.22, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({ points, velocities, life: 0.8, maxLife: 0.8, gravity: -3 });
  }

  spawnDeathParticles(pos) {
    // 灰色方块爆裂
    const N = 18;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = 0.6;
      positions[i * 3 + 2] = pos.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 4
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9a9a9a, size: 0.26, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.particles.push({ points, velocities, life: 0.7, maxLife: 0.7, gravity: -6 });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      const arr = pt.points.geometry.attributes.position.array;
      for (let j = 0; j < pt.velocities.length; j++) {
        const v = pt.velocities[j];
        v.y += pt.gravity * dt;
        arr[j * 3] += v.x * dt;
        arr[j * 3 + 1] += v.y * dt;
        arr[j * 3 + 2] += v.z * dt;
      }
      pt.points.geometry.attributes.position.needsUpdate = true;
      pt.points.material.opacity = Math.max(0, pt.life / pt.maxLife);
      if (pt.life <= 0) {
        this.scene.remove(pt.points);
        pt.points.geometry.dispose();
        pt.points.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  // ---------- 浮动文字 ----------
  spawnFloatText(pos, text, color = '#ffd34d') {
    const sprite = this._makeTextSprite(text, color);
    sprite.position.copy(pos);
    this.scene.add(sprite);
    this.floatTexts.push({ sprite, life: 1.0, maxLife: 1.0, vy: 1.3 });
  }

  _makeTextSprite(text, color) {
    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 64;
    const ctx = cvs.getContext('2d');
    ctx.font = 'bold 44px Microsoft YaHei, sans-serif';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 64, 32);
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  }

  _updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.life -= dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.material.opacity = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.map.dispose();
        f.sprite.material.dispose();
        this.floatTexts.splice(i, 1);
      }
    }
  }

  // ---------- 查询辅助(供 Plant/Zombie 调用) ----------
  /** 本行是否有僵尸在 plantX 前方(左侧, 僵尸从左来袭向右走) */
  hasZombieAhead(row, plantX) {
    for (const z of this.zombies) {
      if (z.dead || z.row !== row) continue;
      const zx = z.mesh.position.x;
      if (zx < plantX + 0.3 && zx > plantX - 14) return true;
    }
    return false;
  }

  /** 同行中挡在僵尸前方的植物(僵尸向右走，植物在右侧) */
  getPlantBlocking(row, zombieX) {
    let best = null, bestDx = Infinity;
    for (const p of this.plants) {
      if (p.dead || p.row !== row) continue;
      const dx = p.mesh.position.x - zombieX; // 正:植物在僵尸右侧
      if (dx > -0.1 && dx <= 0.7 && dx < bestDx) { best = p; bestDx = dx; }
    }
    return best;
  }

  // ---------- 基地/资源辅助(供 EventSystem 调用) ----------
  damageBase(amount) {
    this.baseHp = Math.max(0, this.baseHp - amount);
  }
  healBase(amount) {
    this.baseHp = Math.min(CFG.BASE_HP, this.baseHp + amount);
  }
  spendOrForce(amount) {
    if (this.resource.canAfford(amount)) this.resource.spend(amount);
    else this.resource.value -= amount; // 允许变负 -> 触发失败
  }
  buffAttackSpeed(mul, dur) {
    this._atkSpeedMul = mul; this._atkSpeedEnd = this.clock + dur;
  }
  buffAttackMul(mul, dur) {
    this._atkDebuffMul = mul; this._atkDebuffEnd = this.clock + dur;
  }
  slowAllZombies(dur) {
    this._zombieSlowEnd = this.clock + dur;
  }
  killWeakestZombies(n) {
    const alive = this.zombies.filter((z) => !z.dead).sort((a, b) => a.hp - b.hp);
    for (let i = 0; i < Math.min(n, alive.length); i++) {
      alive[i].dead = true;
      this.spawnDeathParticles(alive[i].mesh.position.clone());
    }
  }
  spawnFreePlant(type) {
    const empties = [];
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        if (!this.grid.isOccupied(r, c)) empties.push({ r, c });
    if (empties.length === 0) { this.ui.toast('没有空位种了！'); return; }
    const { r, c } = empties[Math.floor(Math.random() * empties.length)];
    const plant = createPlant(this.scene, type, r, c, this.grid);
    this.plants.push(plant);
    this.grid.setOccupied(r, c, plant);
    this._spawnPlantParticles(this.grid.gridToWorld(r, c));
    this.playSound('plant');
  }
  freezeRandomPlant(dur) {
    const alive = this.plants.filter((p) => !p.dead && p.frozen <= 0);
    if (alive.length === 0) return;
    alive[Math.floor(Math.random() * alive.length)].frozen = dur;
  }
  removeRandomPlant() {
    const alive = this.plants.filter((p) => !p.dead);
    if (alive.length === 0) return;
    const p = alive[Math.floor(Math.random() * alive.length)];
    p.dead = true;
  }
  toast(msg) { this.ui.toast(msg); }

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
    this.hammerMode = false;
    this.ui.showOverlay(win ? 'win' : 'lose');
    if (this.eventSystem) this.eventSystem.clearGhosts();
  }
}

// 启动
new Game();
