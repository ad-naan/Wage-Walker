import * as THREE from 'three';

/**
 * 僵尸配置表
 * speed: 每秒向右(+x)移动单位; damage: 啃咬伤害
 * 约定：僵尸从左侧房区生成，向右移动进攻右侧工位基地，模型朝向 +x。
 */
export const ZOMBIE_TYPES = {
  client:  { name: '甲方僵尸',   hp: 120, speed: 0.5,  suit: 0x4a90d9, skin: 0xffd9c0, hair: 0x4a2a1a, damage: 18, scale: 1.6 },
  boss:    { name: '画饼老板',   hp: 220, speed: 0.36, suit: 0xd4a017, skin: 0xffe0b0, hair: 0x202020, damage: 22, scale: 1.15 },
  kpi:     { name: 'KPI僵尸',    hp: 180, speed: 0.6,  suit: 0xe53935, skin: 0xffd0c0, hair: 0x1a1a1a, damage: 15, scale: 1.0 },
  traitor: { name: '大老板',     hp: 180, speed: 0.45, suit: 0x1a237e, skin: 0xffe0b0, hair: 0x101010, damage: 20, scale: 1.6 },
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
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x6a6a7a });
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

    // 体型缩放(大老板体型巨大)
    const scale = this.cfg.scale || 1.0;
    if (scale !== 1.0) this.model.scale.setScalar(scale);

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

  // 甲方僵尸：蓝西装+蓝领带+公文包+圆框眼镜+需求文档卷轴+油腻中分头
  buildClient(suitMat, darkMat) {
    // 覆盖腿部材质：卡其裤(明亮)替代深灰腿
    const khakiMat = new THREE.MeshLambertMaterial({ color: 0xc4a062 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    // 腿部子网格(legL/legR 的 children[0] 是裤腿, children[1] 是鞋)
    if (this.legL && this.legL.children[0]) this.legL.children[0].material = khakiMat;
    if (this.legR && this.legR.children[0]) this.legR.children[0].material = khakiMat;
    if (this.legL && this.legL.children[1]) this.legL.children[1].material = shoeMat;
    if (this.legR && this.legR.children[1]) this.legR.children[1].material = shoeMat;
    this.mainMaterials.push(khakiMat);

    // 蓝领带(配合蓝色西装)
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x1a5276 });
    this._part(new THREE.BoxGeometry(0.06, 0.34, 0.02), tieMat, 0, 0.82, 0.21);
    this._part(new THREE.ConeGeometry(0.07, 0.12, 4), tieMat, 0, 0.6, 0.21);
    // 圆框眼镜(金色边框,更油腻)
    const frameMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    this._part(new THREE.TorusGeometry(0.06, 0.012, 6, 14), frameMat, -0.08, 0.02, 0.22, this.head, false);
    this._part(new THREE.TorusGeometry(0.06, 0.012, 6, 14), frameMat, 0.08, 0.02, 0.22, this.head, false);
    // 镜片(反光效果)
    const lensMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, metalness: 0.8, roughness: 0.2 });
    this._part(new THREE.CircleGeometry(0.055, 12), lensMat, -0.08, 0.02, 0.225, this.head, false);
    this._part(new THREE.CircleGeometry(0.055, 12), lensMat, 0.08, 0.02, 0.225, this.head, false);
    // 油腻中分头(额外加一层扁平头发)
    const oilyHair = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
    this._part(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), oilyHair, 0, 0.08, 0, this.head, false);
    // 中分线
    this._part(new THREE.BoxGeometry(0.02, 0.01, 0.24), darkMat, 0, 0.15, 0, this.head, false);
    // 公文包(棕色)
    const caseMat = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    this._part(new THREE.BoxGeometry(0.26, 0.18, 0.1), caseMat, 0, -0.18, 0.32, this.armR.children[0]);
    this._part(new THREE.BoxGeometry(0.12, 0.02, 0.06), new THREE.MeshLambertMaterial({ color: 0xffd700 }), 0, 0.1, 0, this.armR.children[0]);
    // 左手举着"需求文档"卷轴(白色圆柱)
    const scrollMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc });
    const scroll = this._part(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10), scrollMat, 0, -0.27, 0.1, this.armL.children[0], false);
    scroll.rotation.x = Math.PI / 2;
    // 卷轴两端(深色)
    const capMat = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    this._part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), capMat, 0, -0.27, 0.21, this.armL.children[0], false);
    this._part(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10), capMat, 0, -0.27, -0.01, this.armL.children[0], false);
  }

  // 画饼老板：墨镜反光+金色西装+大肚腩+雪茄+公文包+头顶大饼光环
  buildBoss(suitMat, darkMat, hairMat) {
    // 大肚腩(啤酒肚,画饼老板的标志)
    const bellyMat = new THREE.MeshLambertMaterial({ color: this.cfg.suit });
    this.mainMaterials.push(bellyMat);
    this._part(new THREE.SphereGeometry(0.26, 14, 12), bellyMat, 0, 0.72, 0.2);
    // 金色西装扣子
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 });
    this._part(new THREE.SphereGeometry(0.025, 8, 6), btnMat, 0, 0.9, 0.28);
    this._part(new THREE.SphereGeometry(0.025, 8, 6), btnMat, 0, 0.75, 0.3);
    this._part(new THREE.SphereGeometry(0.025, 8, 6), btnMat, 0, 0.6, 0.28);

    // 墨镜(黑色长条+反光) —— 画饼老板的标志
    const sunglassesMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.9, roughness: 0.1 });
    this._part(new THREE.BoxGeometry(0.38, 0.08, 0.04), sunglassesMat, 0, 0.05, 0.2, this.head, false);
    // 墨镜反光高光(白色小点)
    const reflectMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.04, 0.03, 0.01), reflectMat, -0.1, 0.06, 0.225, this.head, false);
    this._part(new THREE.BoxGeometry(0.04, 0.03, 0.01), reflectMat, 0.1, 0.06, 0.225, this.head, false);
    // 墨镜镜片(深色反光)
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1.0, roughness: 0.05 });
    this._part(new THREE.BoxGeometry(0.14, 0.07, 0.02), lensMat, -0.09, 0.05, 0.225, this.head, false);
    this._part(new THREE.BoxGeometry(0.14, 0.07, 0.02), lensMat, 0.09, 0.05, 0.225, this.head, false);

    // 油背头(画饼老板的油腻发型)
    const slickMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    this._part(new THREE.SphereGeometry(0.245, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), slickMat, 0, 0.06, 0, this.head, false);

    // 雪茄(叼在嘴里)
    const cigar = this._part(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), new THREE.MeshLambertMaterial({ color: 0x6d4c41 }), 0.1, -0.12, 0.2, this.head, false);
    cigar.rotation.z = Math.PI / 2;
    this.cigarGlow = this._part(new THREE.SphereGeometry(0.018, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff5500, emissive: 0xff3300, emissiveIntensity: 1 }), 0.17, -0.12, 0.2, this.head, false);

    // 红色领结
    const bowMat = new THREE.MeshLambertMaterial({ color: 0x8e0000 });
    this._part(new THREE.BoxGeometry(0.1, 0.05, 0.03), bowMat, -0.04, 1.1, 0.21);
    this._part(new THREE.BoxGeometry(0.1, 0.05, 0.03), bowMat, 0.04, 1.1, 0.21);
    this._part(new THREE.BoxGeometry(0.03, 0.06, 0.03), bowMat, 0, 1.1, 0.21);

    // 公文包(左手提着,装着空头支票)
    const caseMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
    this._part(new THREE.BoxGeometry(0.22, 0.16, 0.08), caseMat, 0, -0.18, 0.32, this.armL.children[0]);
    // 公文包金色锁扣
    this._part(new THREE.BoxGeometry(0.1, 0.02, 0.04), btnMat, 0, -0.12, 0.36, this.armL.children[0]);
    // 公文包把手
    const handle = this._part(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), btnMat, 0, -0.08, 0.34, this.armL.children[0], false);
    handle.rotation.x = Math.PI / 2;

    // 头顶悬浮"大饼"(画饼老板的标志,旋转发光)
    const pieGroup = new THREE.Group();
    pieGroup.position.set(0, 0.4, 0);
    this.head.add(pieGroup);
    const pieMat = new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xffa000, emissiveIntensity: 0.4 });
    const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16), pieMat);
    pie.rotation.x = Math.PI / 2;
    pieGroup.add(pie);
    // 大饼上的"饼"字
    const pieTex = this._makeTextTexture('饼', '#ff6f00');
    const pieLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({ map: pieTex, transparent: true })
    );
    pieLabel.position.z = 0.02;
    pieLabel.rotation.y = -Math.PI / 2;
    pieGroup.add(pieLabel);
    this.bossPie = pieGroup;
  }

  // KPI僵尸：背图表板+头顶KPI牌+红领带+考核表+红色眼镜
  buildKpi(suitMat, darkMat) {
    // 背后的KPI图表板(更大更醒目)
    const board = new THREE.Group(); board.position.set(0, 1.0, -0.28); this.model.add(board);
    this._part(new THREE.BoxGeometry(0.44, 0.34, 0.03), new THREE.MeshLambertMaterial({ color: 0xfafafa }), 0, 0, 0, board);
    // 三色柱状图(红黄绿,递增)
    const bars = [0xff4d4d, 0xffcc33, 0x33cc66];
    for (let i = 0; i < 3; i++) {
      this._part(new THREE.BoxGeometry(0.08, 0.1 + i * 0.06, 0.02), new THREE.MeshLambertMaterial({ color: bars[i] }), -0.14 + i * 0.14, -0.04, 0.02, board);
    }
    // 图表板边框
    this._part(new THREE.BoxGeometry(0.02, 0.34, 0.02), darkMat, -0.23, 0, 0, board);
    this._part(new THREE.BoxGeometry(0.02, 0.34, 0.02), darkMat, 0.23, 0, 0, board);
    // 板支架
    this._part(new THREE.BoxGeometry(0.02, 0.4, 0.02), darkMat, 0, -0.25, 0, board);

    // 头顶KPI标牌(更大)
    const signMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.34, 0.14, 0.03), signMat, 0, 0.36, 0, this.head, false);
    this._part(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), darkMat, 0, 0.27, 0, this.head, false);
    // KPI文字
    const tex = this._makeTextTexture('KPI', '#e53935');
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.11),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    label.position.set(0, 0.36, 0.021);
    label.rotation.y = -Math.PI / 2;
    this.head.add(label);

    // 红色眼镜(考核官的锐利目光)
    const glassFrame = new THREE.MeshLambertMaterial({ color: 0xb71c1c });
    this._part(new THREE.TorusGeometry(0.06, 0.01, 6, 14), glassFrame, -0.08, 0.02, 0.22, this.head, false);
    this._part(new THREE.TorusGeometry(0.06, 0.01, 6, 14), glassFrame, 0.08, 0.02, 0.22, this.head, false);
    // 眼镜连接桥
    this._part(new THREE.BoxGeometry(0.04, 0.01, 0.01), glassFrame, 0, 0.02, 0.22, this.head, false);

    // 红领带(更宽更醒目)
    const tieMat = new THREE.MeshLambertMaterial({ color: 0xb71c1c });
    this._part(new THREE.BoxGeometry(0.07, 0.34, 0.02), tieMat, 0, 0.82, 0.21);
    this._part(new THREE.ConeGeometry(0.08, 0.13, 4), tieMat, 0, 0.6, 0.21);

    // 左手拿着"考核表"(带红色印章的文件)
    const docMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.18, 0.24, 0.02), docMat, 0, -0.27, 0.1, this.armL.children[0], false);
    // 红色印章(圆形)
    const stampMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
    const stamp = this._part(new THREE.CircleGeometry(0.04, 12), stampMat, 0.04, -0.32, 0.115, this.armL.children[0], false);
    stamp.rotation.y = -Math.PI / 2;
  }

  // 大老板(终极Boss)：深色西装+高尔夫球杆+墨镜+啤酒肚+皇冠+老板椅
  buildTraitor(suitMat, darkMat, hairMat) {
    // 巨大啤酒肚(画饼充饥技的来源)
    const bellyMat = new THREE.MeshLambertMaterial({ color: this.cfg.suit });
    this.mainMaterials.push(bellyMat);
    this._part(new THREE.SphereGeometry(0.3, 16, 14), bellyMat, 0, 0.7, 0.22);

    // 深色西装领(白色衬衫+黑领带)
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.12, 0.2, 0.02), shirtMat, 0, 0.95, 0.24);
    const tieMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    this._part(new THREE.BoxGeometry(0.06, 0.34, 0.02), tieMat, 0, 0.85, 0.25);
    this._part(new THREE.ConeGeometry(0.07, 0.12, 4), tieMat, 0, 0.63, 0.25);

    // 金色西装扣子
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.3 });
    this._part(new THREE.SphereGeometry(0.028, 8, 6), btnMat, 0, 0.95, 0.3);
    this._part(new THREE.SphereGeometry(0.028, 8, 6), btnMat, 0, 0.8, 0.32);
    this._part(new THREE.SphereGeometry(0.028, 8, 6), btnMat, 0, 0.65, 0.3);

    // 墨镜(大老板的标志,比画饼老板更大)
    const sunglassesMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.9, roughness: 0.1 });
    this._part(new THREE.BoxGeometry(0.42, 0.09, 0.04), sunglassesMat, 0, 0.05, 0.2, this.head, false);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 1.0, roughness: 0.05 });
    this._part(new THREE.BoxGeometry(0.16, 0.08, 0.02), lensMat, -0.1, 0.05, 0.225, this.head, false);
    this._part(new THREE.BoxGeometry(0.16, 0.08, 0.02), lensMat, 0.1, 0.05, 0.225, this.head, false);
    // 墨镜反光
    const reflectMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this._part(new THREE.BoxGeometry(0.05, 0.03, 0.01), reflectMat, -0.12, 0.07, 0.235, this.head, false);
    this._part(new THREE.BoxGeometry(0.05, 0.03, 0.01), reflectMat, 0.08, 0.07, 0.235, this.head, false);

    // 金色小皇冠(大老板的终极标志)
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600, emissiveIntensity: 0.4 });
    this._part(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), crownMat, 0, 0.27, 0, this.head, false);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this._part(new THREE.ConeGeometry(0.045, 0.12, 4), crownMat, Math.cos(a) * 0.1, 0.35, Math.sin(a) * 0.1, this.head, false);
    }
    // 皇冠宝石
    const gemMat = new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0033, emissiveIntensity: 0.5 });
    this._part(new THREE.SphereGeometry(0.025, 8, 6), gemMat, 0, 0.3, 0.12, this.head, false);

    // 高尔夫球杆(裁员大棒,右手握着扛在肩上)
    const clubShaftMat = new THREE.MeshLambertMaterial({ color: 0x4a148c });
    const clubHeadMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
    // 球杆杆身
    const shaft = this._part(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8), clubShaftMat, 0, -0.35, 0.2, this.armR.children[0], false);
    // 球杆头(裁员大棒)
    const clubHead = this._part(new THREE.BoxGeometry(0.12, 0.08, 0.05), clubHeadMat, 0, -0.68, 0.2, this.armR.children[0], false);
    // 球杆头上的骷髅标记(红色发光)
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });
    this._part(new THREE.SphereGeometry(0.025, 8, 6), skullMat, 0, -0.68, 0.23, this.armR.children[0], false);
    this.clubGlow = this._part(new THREE.SphereGeometry(0.025, 8, 6), skullMat, 0, -0.68, 0.23, this.armR.children[0], false);

    // 左手拿黄色卷宗(裁员名单)
    this._part(new THREE.BoxGeometry(0.2, 0.16, 0.04), new THREE.MeshLambertMaterial({ color: 0xffeb3b }), 0, -0.18, 0.32, this.armL.children[0]);
    // 卷宗上的红色"裁"字
    const fireTex = this._makeTextTexture('裁', '#d32f2f');
    const fireLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.14),
      new THREE.MeshBasicMaterial({ map: fireTex, transparent: true })
    );
    fireLabel.position.set(0, -0.18, 0.343);
    fireLabel.rotation.y = -Math.PI / 2;
    this.armL.children[0].add(fireLabel);

    // 脚下老板椅底座(真皮老板椅滑行进场)
    const chairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const chairBase = this._part(new THREE.CylinderGeometry(0.3, 0.35, 0.06, 12), chairMat, 0, -0.55, 0, this.model, false);
    // 椅子中央立柱
    this._part(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }), 0, -0.42, 0, this.model, false);
    // 椅子五星脚轮
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this._part(new THREE.BoxGeometry(0.25, 0.04, 0.06), chairMat, Math.cos(a) * 0.2, -0.56, Math.sin(a) * 0.2, this.model, false);
    }
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
    // 画饼老板头顶大饼旋转
    if (this.bossPie) {
      this.bossPie.rotation.z += dt * 2;
      this.bossPie.position.y = 0.4 + Math.sin(performance.now() * 0.004) * 0.05;
    }
    // 大老板球杆骷髅头闪烁
    if (this.clubGlow) this.clubGlow.material.emissiveIntensity = 0.6 + Math.sin(performance.now() * 0.01) * 0.4;

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

  // 画饼老板：光环旋转 + 每走一步有10%概率开除一颗植物(不变暗)
  specialBoss(dt, game) {
    // 首次出现：紧急警告横幅
    if (!this.bossNotified) {
      this.bossNotified = true;
      game.ui.showBossWarning('⚠️ 高管已入场！画饼老板来画饼了！小心植物被开除！');
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
          game.toast('💀 画饼老板发威！直接开除' + name + '！');
          game.playSound('basehit');
        }
      } else {
        game.toast('👑 画饼老板巡视中…这次没开除人');
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

  // 大老板(终极Boss)：出现时全屏变暗 + 定期让向日葵叛变成普通僵尸+扣30摸鱼值
  specialTraitor(dt, game) {
    if (!this._traitorNotified) {
      this._traitorNotified = true;
      this._traitorActionTimer = 0;
      this.bossNotified = true;
      if (game.onBossSpawn) game.onBossSpawn(); // 触发全屏变暗
      game.ui.toast('😈 终极Boss大老板降临！全场变暗，向日葵们开始动摇…');
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
    game.effects.spawnFloatText(game.grid.group, p, '叛变!-30🐟', '#9a4dff');
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
    // 大老板(终极Boss)消失时恢复亮度
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
