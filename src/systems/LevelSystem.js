import { LEVELS, getLevel, getUnlockedItems } from '../levels/LevelConfig.js';
import { PLANT_TYPES } from '../entities/Plant.js';

/**
 * 关卡系统：管理关卡流转、波次生成控制、解锁进度、结算评分。
 * 替代原 main.js 中的倒计时+波次逻辑。
 */
export class LevelSystem {
  constructor(game) {
    this.game = game;
    this.currentLevelId = 1;
    this.maxUnlocked = 1;          // 最大已解锁关卡
    this.currentLevel = null;      // 当前关卡配置
    this.currentWaveIndex = -1;    // 当前波次索引(-1未开始)
    this.waveTimer = 0;            // 下一波倒计时
    this.waveSpawnQueue = [];      // 当前波待生成僵尸队列
    this.specialUses = 0;          // 特供道具使用次数
    this.waveCleared = false;      // 当前波是否已清完生成
  }

  /** 加载已解锁进度(localStorage) */
  loadProgress() {
    try {
      const saved = localStorage.getItem('niuma_progress');
      if (saved) this.maxUnlocked = Math.max(1, parseInt(saved) || 1);
    } catch (e) {}
  }

  saveProgress() {
    try { localStorage.setItem('niuma_progress', String(this.maxUnlocked)); } catch (e) {}
  }

  /** 获取当前关卡可用道具列表(含基础+解锁+特供) */
  getAvailableCards() {
    const items = getUnlockedItems(this.currentLevelId);
    // 加特供道具
    if (this.currentLevel && this.currentLevel.special) {
      const sp = this.currentLevel.special;
      items.push(sp.type);
      // 确保特供道具在PLANT_TYPES中有配置(动态注册)
      if (!PLANT_TYPES[sp.type]) {
        PLANT_TYPES[sp.type] = {
          name: sp.name, cost: 0, hp: 0, icon: '⭐', cd: 0,
          isSpecial: true, isSkill: true, specialLimit: sp.limit,
        };
      }
    }
    return items.map((t) => ({ type: t, ...PLANT_TYPES[t] })).filter((c) => c.name);
  }

  /** 开始指定关卡 */
  startLevel(levelId) {
    this.currentLevelId = levelId;
    this.currentLevel = getLevel(levelId);
    this.currentWaveIndex = -1;
    this.waveTimer = 3; // 3秒后开始第一波
    this.waveSpawnQueue = [];
    this.specialUses = 0;
    this.waveCleared = false;
    return this.currentLevel;
  }

  /** 每帧更新：波次推进+生成僵尸 */
  update(dt, game) {
    if (!this.currentLevel || !game.running) return;

    // 处理当前波次的僵尸生成队列
    this._updateSpawnQueue(dt, game);

    // 波次倒计时
    if (this.waveTimer > 0) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this._startNextWave(game);
      }
      return;
    }

    // 检查当前波是否已全部生成且全部消灭
    if (this.waveSpawnQueue.length === 0 && this.waveCleared) {
      const aliveCount = game.zombies.filter((z) => !z.dead).length;
      if (aliveCount === 0) {
        // 本波清完，准备下一波
        if (this.currentWaveIndex < this.currentLevel.waves.length - 1) {
          this.waveTimer = 4; // 波间间隔4秒
          this.waveCleared = false;
          game.ui.toast(`第 ${this.currentWaveIndex + 1}/${this.currentLevel.waves.length} 波清除！准备下一波…`);
        } else {
          // 全部波次清完 → 通关
          this._onLevelClear(game);
        }
      }
    }
  }

  /** 开始下一波 */
  _startNextWave(game) {
    this.currentWaveIndex++;
    const wave = this.currentLevel.waves[this.currentWaveIndex];
    if (!wave) return;
    this.waveCleared = false;
    this.waveSpawnQueue = [];
    let spawnTime = 0;
    for (const group of wave.zombies) {
      for (let i = 0; i < group.count; i++) {
        this.waveSpawnQueue.push({
          type: group.type,
          hpMul: group.hpMul || 1,
          at: spawnTime,
        });
        spawnTime += group.delay;
      }
    }
    game.ui.toast(`第 ${this.currentWaveIndex + 1}/${this.currentLevel.waves.length} 波来活儿了！`);
    game.ui.updateWaveProgress(this.currentWaveIndex + 1, this.currentLevel.waves.length);
    // 第一波立即开始生成
    this._waveClock = 0;
  }

  _updateSpawnQueue(dt, game) {
    if (this.waveSpawnQueue.length === 0) return;
    this._waveClock = (this._waveClock || 0) + dt;
    for (let i = this.waveSpawnQueue.length - 1; i >= 0; i--) {
      const s = this.waveSpawnQueue[i];
      if (this._waveClock >= s.at) {
        this._spawnZombie(game, s.type, s.hpMul);
        this.waveSpawnQueue.splice(i, 1);
        // 队列清空后标记本波生成完毕
        if (this.waveSpawnQueue.length === 0) this.waveCleared = true;
      }
    }
  }

  _spawnZombie(game, type, hpMul) {
    const row = Math.floor(Math.random() * game.cfg.ROWS);
    // 超级工贼
    if (type === 'super_traitor') {
      const z = game._createZombie('traitor', row);
      z.maxHp = z.hp = Math.round(z.hp * 3);
      z.baseSpeed *= 1.5;
      z._traitorInterval = 0.75; // 策反频率翻倍
      game.zombies.push(z);
      game.ui.toast('💀 超级工贼出现！hp×3 速度×1.5 策反翻倍！');
      return;
    }
    const z = game._createZombie(type, row);
    if (hpMul > 1) { z.maxHp = z.hp = Math.round(z.hp * hpMul); }
    // Lv3 甲方需求变更频率翻倍(每1.5步后退，而非3步)
    if (this.currentLevel.flags && this.currentLevel.flags.clientDoubleRevert && type === 'client') {
      z.revertThreshold = 1.5;
    }
    game.zombies.push(z);
  }

  /** 通关 */
  _onLevelClear(game) {
    game.running = false;
    const hpRatio = game.baseHp / game.cfg.BASE_HP;
    const grade = hpRatio > 0.8 ? 'S' : hpRatio > 0.6 ? 'A' : hpRatio > 0.4 ? 'B' : 'C';
    // 解锁下一关
    if (this.currentLevelId >= this.maxUnlocked && this.currentLevelId < LEVELS.length) {
      this.maxUnlocked = this.currentLevelId + 1;
      this.saveProgress();
    }
    // 显示结算
    game.ui.showLevelResult(grade, this.currentLevel, this.maxUnlocked, false, hpRatio);
    if (game.eventSystem) game.eventSystem.clearGhosts();
  }

  /** 失败 */
  onLevelFail(game) {
    game.running = false;
    game.ui.showLevelResult('F', this.currentLevel, this.maxUnlocked, true, 0);
    if (game.eventSystem) game.eventSystem.clearGhosts();
  }

  /** 特供道具是否可用 */
  canUseSpecial() {
    if (!this.currentLevel || !this.currentLevel.special) return false;
    return this.specialUses < this.currentLevel.special.limit;
  }

  /** 记录特供道具使用 */
  useSpecial() { this.specialUses++; }

  /** 获取特供道具配置 */
  getSpecial() { return this.currentLevel ? this.currentLevel.special : null; }
}
