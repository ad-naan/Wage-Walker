import * as THREE from 'three';

/**
 * 僵尸配置表
 * speed: 每秒向右(+x)移动单位; damage: 啃咬伤害
 * 约定：僵尸从左侧房区生成，向右移动进攻右侧工位基地，模型朝向 +x。
 */
export const ZOMBIE_TYPES = {
  client:  { name: '甲方僵尸', hp: 120, speed: 0.5,  suit: 0xff8fb0, skin: 0xffd9c0, hair: 0x4a2a1a, damage: 18 },
  boss:    { name: '老板僵尸', hp: 220, speed: 0.36, suit: 0xd4a017, skin: 0xffe0b0, hair: 0x202020, damage: 22 },
  kpi:     { name: 'KPI僵尸',  hp: 180, speed: 0.6,  suit: 0xe53935, skin: 0xffd0c0, hair: 0x1a1a1a, damage: 15 },
  traitor: { name: '工贼老板', hp: 180, speed: 0.45, suit: 0x6a1b9a, skin: 0xffe0b0, hair: 0x101010, damage: 20 },
};

/**
 * 僵尸基类：含寻路(直线)、啃咬攻击、特殊行为。
 * 结构：this.mesh(外层,仅位置/浮动/血条/光环) > this.model(内层,旋转Y=π/2使模型朝+x)
 */
export class Zombie {
  constructor(scene, type, row, grid) {
    this.scene = scene;
    this.type = type;
    this.row = row;
    this.grid = grid;
    this.cfg = ZOMBIE_TYPES[type];
    this.maxHp = this.cfg.hp;
    this.hp = this.cfg.hp;
    this.baseSpeed = this.cfg.speed;
    this.speed = this.cfg.speed;
    this.dead = false;
    this.attacking = null;
    this.attackTimer = 0;
    this.aliveTime = 0;
    this.distWalked = 0;   // 累计行走距离(甲方变向用)
    this.revertTimer = 0;  // 甲方后退剩余时间
    this.kpiTick = 0;      // KPI扣款计时
    this.hitFlash = 0;
    this.walkPhase = Math.random() * Math.PI * 2; // 行走相位错开
    this.stunned = 0;           // 眩晕剩余秒数(甩锅大会)
    this.doubleDamage = false;  // 受到伤害翻倍(摸鱼锤砸)
    this.stunFxTimer = 0;       // 眩晕星星动画计时
    this.bossNotified = false;  // Boss变暗是否已通知
    this.bossStepTimer = 0;     // Boss步距计时

    this.mesh = new THREE.Group();
    const start = new THREE.Vector3(grid.getSpawnX(), 0, grid.gridToWorld(row, 0).z);
    this.mesh.position.copy(start);
    this.mesh.userData = { isZombie: true, zombie: this };

    // 内层模型组：整体朝 +x(移动/工位方向)
    this.model = new THREE.Group();
    this.model.rotation.y = Math.PI / 2;
    this.mesh.add(this.model);

    scene.add(this.mesh);
    this.build();
  }

  /** 辅助：创建网格并加入指定父级，返回该网格 */
  _part(geo, mat, x, y, z, parent, cast = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    (parent || this.model).add(m);
    return m;
  }

  build() {
    const cfg = this.cfg;
    // 材质
    const suitMat = new THREE.MeshLambertMaterial({ color: cfg.suit });
    const skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hairMat = new THREE.MeshLambertMaterial({ color: cfg.hair });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xff3300, emissive: 0xff1100, emissiveIntensity: 1.0, roughness: 0.4,
    });
    // 收集需要受击染色的材质
    this.mainMaterials = [suitMat, skinMat, hairMat];

    // ===== 腿 =====
    this.legL = new THREE.Group(); this.legL.position.set(-0.12, 0.5, 0); this.model.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.12, 0.5, 0); this.model.add(this.legR);
    this._part(new THREE.BoxGeometry(0.16, 0.5, 0.16), darkMat, 0, -0.25, 0, this.legL);
    this._part(new THREE.BoxGeometry(0.16, 0.5, 0.16), darkMat, 0, -0.25, 0, this.legR);
    // 鞋(略长向前, +z 为模型正前方, 旋转后对应 +x 移动方向)
    this._part(new THREE.BoxGeometry(0.18, 0.09, 0.26), darkMat, 0, -0.52, 0.05, this.legL);
    this._part(new THREE.BoxGeometry(0.18, 0.09, 0.26), darkMat, 0, -0.52, 0.05, this.legR);

    // ===== 躯干(梯形,上窄下宽) =====
    const torso = this._part(new THREE.CylinderGeometry(0.2, 0.27, 0.66, 10), suitMat, 0, 0.83, 0);
    this.body = torso;
    // 肩膀球
    this._part(new THREE.SphereGeometry(0.13, 10, 8), suitMat, -0.26, 1.08, 0);
    this._part(new THREE.SphereGeometry(0.13, 10, 8), suitMat, 0.26, 1.08, 0);

    // ===== 手臂(前伸僵尸姿势, +z 为前方) =====
    this.armL = new THREE.Group(); this.armL.position.set(-0.28, 1.04, 0); this.model.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.28, 1.04, 0); this.model.add(this.armR);
    // 上臂
    this._part(new THREE.BoxGeometry(0.12, 0.28, 0.12), suitMat, 0, -0.1, 0, this.armL);
    this._part(new THREE.BoxGeometry(0.12, 0.28, 0.12), suitMat, 0, -0.1, 0, this.armR);
    // 前臂(皮肤色,前伸) —— 用子 group 旋转
    const foreL = new THREE.Group(); foreL.position.set(0, -0.24, 0); foreL.rotation.x = -1.25; this.armL.add(foreL);
    const foreR = new THREE.Group(); foreR.position.set(0, -0.24, 0); foreR.rotation.x = -1.25; this.armR.add(foreR);
    this._part(new THREE.BoxGeometry(0.1, 0.26, 0.1), skinMat, 0, -0.13, 0, foreL);
    this._part(new THREE.BoxGeometry(0.1, 0.26, 0.1), skinMat, 0, -0.13, 0, foreR);
    // 手
    this._part(new THREE.SphereGeometry(0.07, 8, 6), skinMat, 0, -0.27, 0, foreL);
    this._part(new THREE.SphereGeometry(0.07, 8, 6), skinMat, 0, -0.27, 0, foreR);

    // ===== 头 =====
    this.head = new THREE.Group(); this.head.position.set(0, 1.42, 0); this.model.add(this.head);
    const skull = this._part(new THREE.SphereGeometry(0.22, 14, 12), skinMat, 0, 0, 0, this.head);
    // 下巴
    this._part(new THREE.SphereGeometry(0.18, 10, 8), skinMat, 0, -0.12, 0.02, this.head);
    // 头发
    this._part(new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat, 0, 0.03, 0, this.head);
    // 眼窝(深色凹陷) —— +z 为正脸
    this._part(new THREE.SphereGeometry(0.05, 8, 6), darkMat, -0.08, 0.02, 0.19, this.head);
    this._part(new THREE.SphereGeometry(0.05, 8, 6), darkMat, 0.08, 0.02, 0.19, this.head);
    // 眼球(发光)
    const eL = this._part(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, -0.08, 0.02, 0.215, this.head, false);
    const eR = this._part(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, 0.08, 0.02, 0.215, this.head, false);
    this.eyes = [eL, eR];
    // 嘴(一条缝)
    this._part(new THREE.BoxGeometry(0.14, 0.02, 0.04), darkMat, 0, -0.1, 0.2, this.head, false);

    // 各类型特色
    if (this.type === 'client') this.buildClient(suitMat, darkMat);
    else if (this.type === 'boss') this.buildBoss(suitMat, darkMat, hairMat);
    else if (this.type === 'kpi') this.buildKpi(suitMat, darkMat);
    else if (this.type === 'traitor') this.buildTraitor(suitMat, darkMat, hairMat);

    // 血条(挂在外层 this.mesh,始终朝镜头 +z, 不随模型旋转)
    this._makeHpBar();

    // 眩晕星星(初始隐藏)
    this._makeStunStars();
  }

  // 甲方僵尸：领带+公文包+圆框眼镜
  buildClient(suitMat, darkMat) {
    const tieMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    this._part(new THREE.BoxGeometry(0.06, 0.34, 0.02), tieMat, 0, 0.82, 0.21);
    this._part(new THREE.ConeGeometry(0.07, 0.12, 4), tieMat, 0, 0.6, 0.21);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    this._part(new THREE.TorusGeometry(0.06, 0.012, 6, 14), frameMat, -0.08, 0.02, 0.22, this.head, false);
    this._part(new THREE.TorusGeometry(0.06, 0.012, 6, 14), frameMat, 0.08, 0.02, 0.22, this.head, false);
    const caseMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    this._part(new THREE.BoxGeometry(0.26, 0.18, 0.1), caseMat, 0, -0.18, 0.32, this.armR.children[0]);
    this._part(new THREE.BoxGeometry(0.12, 0.02, 0.06), new THREE.MeshLambertMaterial({ color: 0xffd700 }), 0, 0.1, 0, this.armR.children[0]);
  }

  // 老板僵尸：礼帽+大肚腩+雪茄+领结
  buildBoss(suitMat, darkMat, hairMat) {
    const bellyMat = new THREE.MeshLambertMaterial({ color: this.cfg.suit });
    this.mainMaterials.push(bellyMat);
    this._part(new THREE.SphereGeometry(0.22, 12, 10), bellyMat, 0, 0.72, 0.18);
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    this._part(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16), hatMat, 0, 0.26, 0, this.head);
    this._part(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 18), hatMat, 0, 0.18, 0, this.head);
    this._part(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 16), new THREE.MeshLambertMaterial({ color: 0xd4a017 }), 0, 0.2, 0, this.head);
    const bowMat = new THREE.MeshLambertMaterial({ color: 0x8e0000 });
    this._part(new THREE.BoxGeometry(0.1, 0.05, 0.03), bowMat, -0.04, 1.1, 0.21);
    this._part(new THREE.BoxGeometry(0.1, 0.05, 0.03), bowMat, 0.04, 1.1, 0.21);
    this._part(new THREE.BoxGeometry(0.03, 0.06, 0.03), bowMat, 0, 1.1, 0.21);
    const cigar = this._part(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), new THREE.MeshLambertMaterial({ color: 0x6d4c41 }), 0.1, -0.12, 0.2, this.head, false);
    cigar.rotation.z = Math.PI / 2;
    this.cigarGlow = this._part(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff3300, emissiveIntensity: 1 }), 0.17, -0.12, 0.2, this.head, false);
  }

  // KPI僵尸：背图表板+头顶KPI牌+领带
  buildKpi(suitMat, darkMat) {
    const board = new THREE.Group(); board.position.set(0, 1.0, -0.28); this.model.add(board);
    this._part(new THREE.BoxGeometry(0.4, 0.3, 0.03), new THREE.MeshLambertMaterial({ color: 0xfafafa }), 0, 0, 0, board);
    const bars = [0xff4d4d, 0xffcc33, 0x33cc66];
    for (let i = 0; i < 3; i++) {
      this._part(new THREE.BoxGeometry(0.07, 0.08 + i * 0.05, 0.02), new THREE.MeshLambertMaterial({ color: bars[i] }), -0.12 + i * 0.12, -0.05, 0.02, board);
    }
    this._part(new THREE.BoxGeometry(0.02, 0.4, 0.02), darkMat, 0, -0.25, 0, board);
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.3, 0.12, 0.03), signMat, 0, 0.34, 0, this.head, false);
    this._part(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), darkMat, 0, 0.26, 0, this.head, false);
    // 用 canvas 文字贴 "KPI" —— 朝镜头(+z)显示, 抵消模型 Y 旋转
    const tex = this._makeTextTexture('KPI', '#e53935');
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.09),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    label.position.set(0, 0.34, 0.021);
    label.rotation.y = -Math.PI / 2; // 抵消 model 的 Y 旋转, 使文字朝 +z 镜头
    this.head.add(label);
    // 红领带
    const tieMat = new THREE.MeshLambertMaterial({ color: 0xb71c1c });
    this._part(new THREE.BoxGeometry(0.06, 0.32, 0.02), tieMat, 0, 0.82, 0.21);
  }

  // 工贼老板：紫色领带+小皇冠+卷宗
  buildTraitor(suitMat, darkMat, hairMat) {
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x6a1b9a });
    this._part(new THREE.BoxGeometry(0.06, 0.34, 0.02), tieMat, 0, 0.82, 0.21);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.3 });
    const cb = this._part(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), crownMat, 0, 0.26, 0, this.head, false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this._part(new THREE.ConeGeometry(0.04, 0.1, 4), crownMat, Math.cos(a) * 0.1, 0.32, Math.sin(a) * 0.1, this.head, false);
    }
    this._part(new THREE.BoxGeometry(0.18, 0.14, 0.04), new THREE.MeshLambertMaterial({ color: 0xffeb3b }), 0, -0.18, 0.32, this.armR.children[0]);
  }

  _makeTextTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = color;
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  _makeHpBar() {
    const g = new THREE.Group();
    g.position.set(0, 1.95, 0);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.08), new THREE.MeshBasicMaterial({ color: 0x331111, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.08), new THREE.MeshBasicMaterial({ color: 0x44dd44, side: THREE.DoubleSide }));
    fg.position.z = 0.001;
    g.add(bg); g.add(fg);
    this.hpBar = fg; this.hpBarGroup = g;
    this.mesh.add(g); // 挂外层, 朝 +z 镜头
  }

  /** 眩晕星星(头顶旋转) */
  _makeStunStars() {
    this.stunGroup = new THREE.Group();
    this.stunGroup.position.set(0, 2.2, 0);
    this.stunGroup.visible = false;
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this._part(new THREE.OctahedronGeometry(0.08), starMat, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, this.stunGroup, false);
    }
    this.mesh.add(this.stunGroup);
  }

  update(dt, game) {
    this.aliveTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // 眩晕状态：不动不攻击，只播放眩晕动画
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.stunFxTimer += dt;
      this.stunGroup.visible = true;
      this.stunGroup.rotation.y += dt * 4;
      this.stunGroup.position.y = 2.2 + Math.sin(performance.now() * 0.006) * 0.1;
      // 眩晕晃动
      this.mesh.position.y = Math.sin(performance.now() * 0.01) * 0.05;
      this.mesh.rotation.z = Math.sin(performance.now() * 0.008) * 0.08;
      // 受击染色
      const flash = this.hitFlash > 0;
      for (const m of this.mainMaterials) m.emissive.setHex(flash ? 0x661111 : 0x000000);
      this._updateHpBar();
      // 死亡检测
      if (this.hp <= 0) this._die(game);
      return;
    }
    this.stunGroup.visible = false;
    this.walkPhase += dt * (this.attacking ? 2 : 8);

    // 寻找前方阻挡的植物(同行右侧)
    const blocker = game.getPlantBlocking(this.row, this.mesh.position.x);
    if (blocker && !blocker.dead) {
      this.attacking = blocker;
      this.attackPlant(blocker, dt, game);
    } else {
      this.attacking = null;
      this.move(dt, game);
    }

    this.special(dt, game);

    // ===== 动画 =====
    const swing = Math.sin(this.walkPhase) * (this.attacking ? 0.15 : 0.6);
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    if (this.armL) this.armL.rotation.x = -1.25 + swing * 0.3;
    if (this.armR) this.armR.rotation.x = -1.25 - swing * 0.3;
    // 上下颠
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05;
    if (!this.attacking) this.mesh.rotation.z = Math.sin(this.walkPhase * 0.5) * 0.03;

    // 受击染色(遍历所有主体材质)
    const flash = this.hitFlash > 0;
    for (const m of this.mainMaterials) m.emissive.setHex(flash ? 0x661111 : 0x000000);

    // 眼球闪烁
    const glow = 0.7 + Math.sin(performance.now() * 0.008) * 0.3;
    if (this.eyes) for (const e of this.eyes) e.material.emissiveIntensity = glow;
    if (this.cigarGlow) this.cigarGlow.material.emissiveIntensity = glow;

    this._updateHpBar();

    // 死亡
    if (this.hp <= 0) { this._die(game); return; }

    // 到达基地(右侧)
    if (this.mesh.position.x > this.grid.getBaseX()) {
      game.damageBase(this.cfg.damage);
      game.playSound('basehit');
      this.dead = true; // 撞进基地后消失
    }
  }

  _updateHpBar() {
    if (this.hpBar) {
      const r = Math.max(0, this.hp / this.maxHp);
      this.hpBar.scale.x = r;
      this.hpBar.position.x = -(1 - r) * 0.25;
      this.hpBar.material.color.setHex(r > 0.5 ? 0x44dd44 : r > 0.25 ? 0xffcc33 : 0xff3333);
      this.hpBarGroup.visible = r < 0.999;
    }
  }

  _die(game) {
    this.dead = true;
    game.particles.spawnDeath(game.grid.group, this.mesh.position.clone());
    game.audio.play('die');
    // 击杀回调：怨气值+工时券掉落
    if (game.onZombieKilled) game.onZombieKilled(this);
    // Boss击杀掉落大量摸鱼值
    if (this.type === 'boss') {
      game.onBossKilled();
    }
    // 普通僵尸击杀掉落少量摸鱼值
    if (this.type !== 'boss') {
      const drop = Math.round(this.cfg.hp * 0.1);
      game.resource.add(drop);
    }
  }

  move(dt, game) {
    let v = this.speed;
    // 甲方后退
    if (this.revertTimer > 0) {
      this.revertTimer -= dt;
      v = -this.baseSpeed * 0.8; // 向左后退
    }
    const dx = v * dt;
    this.mesh.position.x += dx;
    this.distWalked += Math.abs(dx);
  }

  attackPlant(plant, dt, game) {
    this.attackTimer += dt;
    if (this.attackTimer >= 0.8) {
      this.attackTimer = 0;
      plant.takeDamage(this.cfg.damage);
      game.playSound('bite');
    }
    // 啃咬前倾动画
    if (this.head) this.head.position.z = 0.05 + Math.sin(performance.now() * 0.02) * 0.08;
  }

  /** 各类型特殊行为 */
  special(dt, game) {
    switch (this.type) {
      case 'client': this.specialClient(dt, game); break;
      case 'boss':   this.specialBoss(dt, game); break;
      case 'kpi':    this.specialKpi(dt, game); break;
      case 'traitor': this.specialTraitor(dt, game); break;
    }
  }

  // 甲方僵尸：每走3步突然变向/后退(模拟需求变更)
  // Lv3 clientDoubleRevert 时 revertThreshold=1.5(频率翻倍)
  specialClient(dt, game) {
    const threshold = this.revertThreshold || 3;
    if (this.revertTimer <= 0 && this.distWalked >= threshold) {
      this.distWalked = 0;
      this.revertTimer = 0.8 + Math.random() * 0.6;
      game.toast('甲方改需求了！僵尸后退中…');
    }
  }

  // 老板僵尸：光环旋转 + 每走一步有10%概率开除一颗植物(不变暗)
  specialBoss(dt, game) {
    // 首次出现：紧急警告横幅
    if (!this.bossNotified) {
      this.bossNotified = true;
      game.ui.showBossWarning('⚠️ 紧急！老板来巡视了！小心植物被开除！');
      game.audio.play('basehit');
    }
    if (!this.ring) {
      this.ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.0, 0.08, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.7 })
      );
      this.ring.rotation.x = Math.PI / 2; // 水平
      this.ring.position.y = 0.1;
      this.mesh.add(this.ring); // 挂外层, 不受 model Y 旋转影响
    }
    this.ring.rotation.z += dt * 2;
    const ringScale = 1 + Math.sin(performance.now() * 0.004) * 0.1;
    this.ring.scale.set(ringScale, ringScale, 1);

    // 每走一步(约2.5秒)有10%概率随机开除一颗植物(向日葵或其它植物)
    // 优先威胁向日葵(断玩家资源), 其次随机植物
    this.bossStepTimer += dt;
    if (this.bossStepTimer >= 2.5 && !this.attacking) {
      this.bossStepTimer = 0;
      if (Math.random() < 0.1) {
        const alive = game.plants.filter((p) => !p.dead && p.invincible <= 0);
        if (alive.length > 0) {
          // 60%概率优先开除向日葵(断资源), 40%随机开除任意植物
          const sunflowers = alive.filter((p) => p.type === 'sunflower');
          let target;
          if (sunflowers.length > 0 && Math.random() < 0.6) {
            target = sunflowers[Math.floor(Math.random() * sunflowers.length)];
          } else {
            target = alive[Math.floor(Math.random() * alive.length)];
          }
          target.dead = true;
          game.particles.spawnDeath(game.grid.group, target.mesh.position.clone());
          const name = target.cfg ? target.cfg.name : '一颗植物';
          game.toast('💀 老板巡视！直接开除' + name + '！');
          game.playSound('basehit');
        }
      } else {
        game.toast('👑 老板巡视中…这次没开除人');
      }
    }
  }

  // KPI僵尸：存活超过15秒，每8秒扣基地血量(绩效扣款)
  specialKpi(dt, game) {
    if (this.aliveTime > 15) {
      this.kpiTick += dt;
      if (this.kpiTick >= 8) {
        this.kpiTick = 0;
        game.damageBase(4);
        game.toast('KPI扣款！工位血量-4');
        game.playSound('basehit');
      }
    }
  }

  // 工贼老板(终极Boss)：出现时全屏变暗 + 定期让向日葵叛变成普通僵尸+扣30摸鱼值
  specialTraitor(dt, game) {
    if (!this._traitorNotified) {
      this._traitorNotified = true;
      this._traitorActionTimer = 0;
      this.bossNotified = true;
      if (game.onBossSpawn) game.onBossSpawn(); // 触发全屏变暗
      game.ui.toast('😈 终极Boss工贼老板降临！全场变暗，向日葵们开始动摇…');
    }
    this._traitorActionTimer += dt;
    // 策反间隔至少10秒，避免过快
    const interval = this._traitorInterval || 10;
    if (this._traitorActionTimer < interval) return;
    this._traitorActionTimer = 0;
    // 应急日报系统免疫策反
    if (game.items && game.items.emergencyReportTimer > 0) {
      game.ui.toast('🛡️ 应急日报护体！向日葵未被策反');
      return;
    }
    const suns = game.plants.filter((p) => !p.dead && p.type === 'sunflower');
    if (suns.length === 0) return;
    const t = suns[Math.floor(Math.random() * suns.length)];
    const pos = t.mesh.position.clone();
    const row = t.row;
    // 向日葵叛变消失
    t.dead = true;
    game.particles.spawnDeath(game.grid.group, pos);
    game.resource.add(-30);
    const p = pos.clone(); p.y += 1.5;
    game.effects.spawnFloatText(game.grid.group, p, '工贼!-30🐟', '#9a4dff');
    game.ui.toast('😈 向日葵叛变成为甲方僵尸！摸鱼值-30');
    game.audio.play('die');
    // 叛变的向日葵变成普通甲方僵尸，从原位置继续前进
    const z = createZombie(game.grid.group, 'client', row, game.grid);
    z.mesh.position.x = pos.x;
    z.mesh.position.z = pos.z;
    game.zombies.push(z);
  }

  takeDamage(d) {
    // 摸鱼锤砸中：伤害翻倍
    const real = this.doubleDamage ? d * 2 : d;
    this.hp -= real;
    this.hitFlash = 0.12;
  }

  destroy(game) {
    // 工贼老板(终极Boss)消失时恢复亮度
    if (this.type === 'traitor' && this.bossNotified && game.onBossDie) {
      game.onBossDie();
    }
    game.grid.group.remove(this.mesh);
    this.mesh.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
    });
    this.dead = true;
  }
}

/** 工厂：根据类型创建僵尸 */
export function createZombie(scene, type, row, grid) {
  return new Zombie(scene, type, row, grid);
}
