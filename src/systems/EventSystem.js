import * as THREE from 'three';

/**
 * 牛头指导干扰系统（核心特色）：
 * - 游戏开始后每 15-25 秒随机触发。
 * - 弹出两条选项，选择后立即执行 buff/debuff。
 * - 8 秒未选则强制执行最坑项。
 * - 触发时场景中生成"牛头幽灵"，可用摸鱼锤敲碎打断(20%概率反向加班惩罚)。
 */
export class EventSystem {
  constructor(game) {
    this.game = game;
    this.timer = this._nextInterval();
    this.active = false;
    this.currentEvent = null;
    this.decisionEnd = 0;
    this.ghosts = [];
    this.pool = this._buildPool();
  }

  reset() {
    this.timer = this._nextInterval();
    this.active = false;
    this.currentEvent = null;
    this.clearGhosts();
  }

  _nextInterval() {
    return 15 + Math.random() * 10; // 15-25s
  }

  _buildPool() {
    return [
      {
        title: '🐮 牛头指导：要不要全员加班冲业绩？',
        options: [
          { text: '给所有植物攻速+50%，但扣30摸鱼值', worst: false,
            effect: (g) => { g.spendOrForce(30); g.buffAttackSpeed(1.5, 12); g.toast('全员加班！植物攻速提升12秒'); } },
          { text: '获得50摸鱼值，但随机冻结一块植物5秒', worst: true,
            effect: (g) => { g.resource.add(50); g.freezeRandomPlant(5); g.toast('摸鱼值+50，但一块植物被冻结了'); } },
        ],
      },
      {
        title: '🐮 牛头指导：这版方案不行，重做！',
        options: [
          { text: '所有僵尸减速3秒', worst: false,
            effect: (g) => { g.slowAllZombies(3); g.toast('甲方犹豫了！僵尸减速3秒'); } },
          { text: '立即获得100摸鱼值，但工位扣10血', worst: true,
            effect: (g) => { g.resource.add(100); g.damageBase(10); g.toast('摸鱼值+100，工位被甲方骂到-10血'); } },
        ],
      },
      {
        title: '🐮 牛头指导：给你个"成长机会"！',
        options: [
          { text: '随机免费种一棵PPT豌豆射手', worst: false,
            effect: (g) => { g.spawnFreePlant('peashooter'); g.toast('免费送你一棵豌豆射手！'); } },
          { text: '摸鱼值+80，但所有植物攻击力减半10秒', worst: true,
            effect: (g) => { g.resource.add(80); g.buffAttackMul(0.5, 10); g.toast('摸鱼值+80，植物被PUA攻击减半'); } },
        ],
      },
      {
        title: '🐮 牛头指导：月度绩效考核时间！',
        options: [
          { text: '工位回血20', worst: false,
            effect: (g) => { g.healBase(20); g.toast('表现良好！工位回血20'); } },
          { text: '摸鱼值翻倍，但立刻再触发一次牛头事件', worst: true,
            effect: (g) => { g.resource.add(g.resource.get()); g.toast('摸鱼值翻倍，但牛头又来了…'); this.timer = 1.5; } },
        ],
      },
      {
        title: '🐮 牛头指导：优化一下人员结构？',
        options: [
          { text: '清除场上最弱的3个僵尸', worst: false,
            effect: (g) => { g.killWeakestZombies(3); g.toast('裁员广进！清除了3个僵尸'); } },
          { text: '获得60摸鱼值，但随机移除一棵植物', worst: true,
            effect: (g) => { g.resource.add(60); g.removeRandomPlant(); g.toast('摸鱼值+60，但一棵植物被优化了'); } },
        ],
      },
    ];
  }

  update(dt, now) {
    if (this.active) {
      if (now >= this.decisionEnd) {
        this._forceWorst();
      }
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.trigger(now);
    }
  }

  trigger(now) {
    this.active = true;
    this.currentEvent = this.pool[Math.floor(Math.random() * this.pool.length)];
    this.decisionEnd = now + 8;
    this.game.ui.showNiuEvent(this.currentEvent, (idx) => this.choose(idx), this.decisionEnd);
    this._spawnGhost();
    this.game.toast('🐮 牛头指导出现了！可用摸鱼锤敲碎幽灵打断');
  }

  choose(idx) {
    if (!this.active) return;
    const opt = this.currentEvent.options[idx];
    this._finish();
    opt.effect(this.game);
  }

  _forceWorst() {
    if (!this.active) return;
    const idx = this.currentEvent.options.findIndex((o) => o.worst);
    const opt = this.currentEvent.options[idx >= 0 ? idx : 0];
    this._finish();
    this.game.toast('⚠️ 时间到！牛头强制执行最坑项');
    opt.effect(this.game);
  }

  _finish() {
    this.active = false;
    this.currentEvent = null;
    this.game.ui.hideNiuEvent();
    this.clearGhosts();
    this.timer = this._nextInterval();
  }

  /** 生成牛头幽灵(可被摸鱼锤敲碎打断) */
  _spawnGhost() {
    const g = this.game;
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      1.6 + Math.random() * 1.5,
      (Math.random() - 0.5) * 8
    );
    const group = new THREE.Group();
    group.position.copy(pos);
    // 牛头：球体 + 两个角
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 14),
      new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.8 })
    );
    group.add(head);
    const hornMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 });
    const h1 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 8), hornMat);
    h1.position.set(-0.25, 0.45, 0); h1.rotation.z = 0.3; group.add(h1);
    const h2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 8), hornMat);
    h2.position.set(0.25, 0.45, 0); h2.rotation.z = -0.3; group.add(h2);
    // 眼睛
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3322 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
    e1.position.set(-0.15, 0.05, 0.42); group.add(e1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
    e2.position.set(0.15, 0.05, 0.42); group.add(e2);

    group.userData = { isGhost: true };
    g.grid.group.add(group);
    const ghost = { mesh: group, baseY: pos.y, born: performance.now() };
    this.ghosts.push(ghost);
  }

  getGhosts() {
    return this.ghosts;
  }

  /** 摸鱼锤敲碎幽灵：打断本次干扰(20%概率反向加班惩罚) */
  smashGhost(ghost) {
    const idx = this.ghosts.indexOf(ghost);
    if (idx < 0) return;
    this.ghosts.splice(idx, 1);
    this.game.grid.group.remove(ghost.mesh);
    ghost.mesh.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    if (!this.active) {
      this.game.toast('敲了个寂寞，当前没有干扰');
      return;
    }
    // 20% 反向加班
    if (Math.random() < 0.2) {
      this.game.toast('💀 反向加班！倒扣30摸鱼值');
      this.game.resource.add(-30);
      this._finish();
    } else {
      this.game.toast('🔨 牛头被敲碎！干扰已打断');
      this._finish();
    }
  }

  clearGhosts() {
    for (const gh of this.ghosts) {
      this.game.grid.group.remove(gh.mesh);
      gh.mesh.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
    this.ghosts = [];
  }

  /** 每帧更新幽灵浮动旋转 */
  updateGhosts(dt) {
    for (const gh of this.ghosts) {
      gh.mesh.position.y = gh.baseY + Math.sin(performance.now() * 0.003) * 0.2;
      gh.mesh.rotation.y += dt * 1.5;
    }
  }
}
