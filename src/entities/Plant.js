import * as THREE from 'three';
import { Projectile } from './Projectile.js';

/**
 * 植物配置表
 * cost 摸鱼值消耗; hp 血量; cd 卡片冷却(秒)
 */
export const PLANT_TYPES = {
  sunflower:  { name: '向日葵社畜',   cost: 20,  hp: 120, icon: '🌻', cd: 5,
                produce: 30, produceInterval: 4, clickGain: 5 },
  peashooter: { name: 'PPT豌豆射手', cost: 100, hp: 120, icon: '📄', cd: 5,
                damage: 20, fireInterval: 1.4, chargeDamage: 80, chargeCost: 50 },
  wallnut:    { name: '996坚果墙',   cost: 50,  hp: 800, icon: '🥜', cd: 20,
                drain: 10, drainInterval: 60 },
  hammer:     { name: '摸鱼锤',     cost: 20,  hp: 0,   icon: '🔨', cd: 15, isSkill: true },
  shield:     { name: '工位护盾',   cost: 100, hp: 0,   icon: '🛡️', cd: 30, isSkill: true },
  heal:       { name: '全员回血',   cost: 50,  hp: 0,   icon: '💊', cd: 25, isSkill: true },
  ult:        { name: '甩锅大会',   cost: 0,   hp: 0,   icon: '🎪', cd: 60, isSkill: true },
};

/**
 * 植物基类：包含种植、待机动画、攻击/生产逻辑骨架。
 * 子类重写 build() 与 behavior(dt, game)。
 */
export class Plant {
  constructor(scene, type, row, col, grid) {
    this.scene = scene;
    this.type = type;
    this.row = row;
    this.col = col;
    this.grid = grid;
    this.cfg = PLANT_TYPES[type];
    this.maxHp = this.cfg.hp;
    this.hp = this.cfg.hp;
    this.dead = false;
    this.attackMul = 1;     // 攻击力倍率(老板光环/事件会减半)
    this.fireRateMul = 1;   // 攻速倍率(加班事件会提升)
    this.frozen = 0;        // 冻结剩余秒数
    this.invincible = 0;    // 无敌剩余秒数(福报彩蛋)
    this.timer = Math.random() * 1.5; // 错开节奏
    this.hitFlash = 0;

    this.mesh = new THREE.Group();
    const pos = grid.gridToWorld(row, col);
    this.mesh.position.set(pos.x, 0, pos.z);
    this.mesh.userData = { isPlant: true, plant: this };
    scene.add(this.mesh);
    this.build();
  }

  build() {}

  update(dt, game) {
    if (this.frozen > 0) {
      this.frozen -= dt;
      this.mesh.position.y = Math.sin(performance.now() * 0.01) * 0.05;
      // 冻结发蓝
      this.applyColorTint(0x88aaff);
      return;
    }
    if (this.invincible > 0) this.invincible -= dt;
    this.timer += dt;
    this.idle();
    this.behavior(dt, game);

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      this.applyColorTint(0xff8888);
    } else if (this.invincible > 0) {
      this.applyColorTint(0xffe066); // 无敌金光
    } else {
      this.applyColorTint(null);
    }
  }

  idle() {
    // Y轴上下浮动 + Z轴小幅旋转
    const t = performance.now() * 0.003;
    this.mesh.position.y = Math.sin(t + this.col) * 0.08;
    this.mesh.rotation.z = Math.sin(t * 0.7 + this.row) * 0.04;
  }

  behavior(dt, game) {}

  takeDamage(d) {
    if (this.invincible > 0) return; // 福报无敌
    this.hp -= d;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.dead = true;
  }

  /** 临时染色(受击红/冻结蓝/无敌金)，通过遍历子 mesh 材质 emissive 实现 */
  applyColorTint(colorHex) {
    this.mesh.traverse((c) => {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material.emissive.setHex(colorHex == null ? 0x000000 : colorHex);
      }
    });
  }

  destroy(game) {
    game.grid.group.remove(this.mesh);
    this.mesh.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    this.dead = true;
  }
}

/** 向日葵社畜：产出摸鱼值，附带"抖腿"待机动画；点击额外产出(有老板路过风险) */
export class Sunflower extends Plant {
  build() {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 0.8, 8),
      new THREE.MeshLambertMaterial({ color: 0x2e8b3e })
    );
    stem.position.y = 0.4; stem.castShadow = true;
    this.mesh.add(stem);

    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xffd34d })
    );
    this.head.position.y = 0.95; this.head.castShadow = true;
    this.mesh.add(this.head);

    // 花瓣
    const petalGeo = new THREE.ConeGeometry(0.16, 0.4, 5);
    const petalMat = new THREE.MeshLambertMaterial({ color: 0xffb300 });
    for (let i = 0; i < 8; i++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      const a = (i / 8) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.5, 0.95, Math.sin(a) * 0.5);
      petal.rotation.z = Math.PI / 2 - a;
      petal.castShadow = true;
      this.mesh.add(petal);
    }
  }

  behavior(dt, game) {
    // 血量越低，越想摸鱼，产出越慢(间隔拉长；最低0.3倍速)
    const baseHp = (game.cfg ? game.cfg.BASE_HP : 100);
    const hpRatio = Math.max(0.3, (game.baseHp || baseHp) / baseHp);
    const interval = this.cfg.produceInterval / hpRatio;
    if (this.timer >= interval) {
      this.timer = 0;
      // 下班高峰摸鱼值翻倍
      const mul = game.moyuMul || 1;
      const amount = Math.round(this.cfg.produce * mul);
      game.resource.add(amount);
      const p = this.mesh.position.clone(); p.y += 1.4;
      game.spawnFloatText(p, '+' + amount, '#ffd34d');
      game.playSound('produce');
    }
    // 抖腿：头部小幅度快速横向抖动
    this.head.position.x = Math.sin(performance.now() * 0.02) * 0.03;
    // 点击放大反馈缓动恢复
    const targetS = 1;
    this.head.scale.x += (targetS - this.head.scale.x) * Math.min(1, dt * 8);
    this.head.scale.y = this.head.scale.z = this.head.scale.x;
  }

  /** 点击产出摸鱼值(老板路过机制由game控制) */
  onClick(game) {
    const mul = game.moyuMul || 1;
    const amount = Math.round(this.cfg.clickGain * mul);
    game.resource.add(amount);
    const p = this.mesh.position.clone(); p.y += 1.4;
    game.spawnFloatText(p, '+' + amount, '#ffd34d');
    game.playSound('produce');
    // 头部点击反馈：短暂放大
    this.head.scale.setScalar(1.2);
  }
}

/** PPT豌豆射手：疲惫社畜举激光笔，发射 Word 文档弹丸，伤害20，攻速1.4s；长按蓄力发射年终总结 */
export class Peashooter extends Plant {
  build() {
    const suitMat = new THREE.MeshLambertMaterial({ color: 0x2a4a8a });
    const suitDark = new THREE.MeshLambertMaterial({ color: 0x1a3060 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd2b8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x2a1a14 });
    const ecMat = new THREE.MeshLambertMaterial({ color: 0x7a5a5a }); // 黑眼圈

    // 主体容器(后坐力整体后移)
    this.body = new THREE.Group();
    this.body.position.y = 0.55;
    this.mesh.add(this.body);
    this.muzzleFlash = 0;
    this.charging = false;        // 是否正在蓄力
    this.chargeFx = 0;            // 蓄力光效强度
    this.clickCount = 0;          // 连点计数(彩蛋)
    this.lastClickTime = 0;

    // 躯干(圆胖西装)
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), suitMat);
    torso.scale.set(1, 1.08, 0.92); torso.castShadow = true;
    this.body.add(torso);
    // 胸前浅色片
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), new THREE.MeshLambertMaterial({ color: 0x3a5aa0 }));
    chest.position.set(0, 0.02, 0.2); chest.scale.set(1, 1, 0.5); this.body.add(chest);
    // 领带
    const tieMat = new THREE.MeshLambertMaterial({ color: 0xc0392b });
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.02), tieMat);
    tie.position.set(0, -0.04, 0.27); this.body.add(tie);
    const tieKnot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 4), tieMat);
    tieKnot.position.set(0, 0.14, 0.27); this.body.add(tieKnot);
    // 纽扣
    for (let i = 0; i < 2; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), darkMat);
      btn.position.set(0, -0.02 - i * 0.12, 0.28); this.body.add(btn);
    }

    // 头部
    const head = new THREE.Group(); head.position.set(0, 0.44, 0.03); this.body.add(head);
    this.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 16), skinMat);
    skull.castShadow = true; head.add(skull);
    // 下巴
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
    jaw.position.set(0, -0.14, 0.02); jaw.scale.set(1, 0.7, 0.9); head.add(jaw);
    // 头发(稀疏地中海)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.268, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    head.add(hair);
    // 耳朵
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMat);
    earL.scale.set(0.5, 1, 1); earL.position.set(-0.25, -0.02, 0); head.add(earL);
    const earR = earL.clone(); earR.position.x = 0.25; head.add(earR);
    // 黑眼圈(疲惫)
    const ecL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), ecMat);
    ecL.scale.set(1, 0.62, 0.4); ecL.position.set(-0.09, -0.01, 0.21); head.add(ecL);
    const ecR = ecL.clone(); ecR.position.x = 0.09; head.add(ecR);
    // 眼白
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
    eL.scale.set(1, 0.55, 0.5); eL.position.set(-0.09, 0.0, 0.225); head.add(eL);
    const eR = eL.clone(); eR.position.x = 0.09; head.add(eR);
    // 瞳孔(向下看,疲惫)
    const pMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), pMat);
    pL.position.set(-0.09, -0.015, 0.245); head.add(pL);
    const pR = pL.clone(); pR.position.x = 0.09; head.add(pR);
    // 圆框眼镜
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const glL = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.01, 6, 16), frameMat);
    glL.position.set(-0.09, 0.0, 0.235); head.add(glL);
    const glR = glL.clone(); glR.position.x = 0.09; head.add(glR);
    // 鼻梁
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.03), frameMat);
    bridge.position.set(0, 0.0, 0.245); head.add(bridge);
    // 嘴(疲惫下垂)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), darkMat);
    mouth.position.set(0, -0.16, 0.22); head.add(mouth);

    // 手臂前伸举激光笔(朝 -x 射击方向, 僵尸从左侧来袭)
    const armGroup = new THREE.Group(); armGroup.position.set(-0.18, 0.18, 0.05); armGroup.rotation.y = Math.PI; this.body.add(armGroup);
    // 上臂
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), suitMat);
    upperArm.position.set(0.17, 0, 0); upperArm.castShadow = true; armGroup.add(upperArm);
    // 手
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
    hand.position.set(0.36, 0, 0); armGroup.add(hand);
    // 激光笔(圆柱朝 +x, 经 armGroup Y=π 旋转变为世界 -x)
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), suitDark);
    laser.rotation.z = Math.PI / 2; laser.position.set(0.5, 0, 0); armGroup.add(laser);
    // 激光笔笔夹(金色)
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
    clip.position.set(0.48, 0.05, 0); armGroup.add(clip);
    // 枪口发光球
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff3300, emissiveIntensity: 0.3, roughness: 0.3 })
    );
    this.muzzle.position.set(0.66, 0, 0); armGroup.add(this.muzzle);
    this.armGroup = armGroup;
  }

  behavior(dt, game) {
    const interval = this.cfg.fireInterval / (this.fireRateMul || 1);
    if (this.timer >= interval && !this.charging) {
      // 仅当本行前方(左侧, 僵尸来袭方向)有僵尸时才射击
      if (game.hasZombieAhead(this.row, this.mesh.position.x)) {
        this.timer = 0;
        this._shoot(game, false);
      }
    }
    this.body.position.x += (0 - this.body.position.x) * Math.min(1, dt * 10);
    // 枪口闪光衰减
    if (this.muzzle) {
      const f = Math.max(0, this.muzzleFlash);
      this.muzzle.material.emissiveIntensity = 0.25 + f * 5;
      this.muzzle.scale.setScalar(1 + f * 1.2);
      if (f > 0) this.muzzleFlash = f - dt;
    }
    // 蓄力光效
    if (this.charging) {
      this.chargeFx = Math.min(1, this.chargeFx + dt * 0.8);
      if (this.muzzle) {
        this.muzzle.material.emissiveIntensity = 0.25 + this.chargeFx * 8;
        this.muzzle.scale.setScalar(1 + this.chargeFx * 2.5);
      }
    } else {
      this.chargeFx = 0;
    }
    // 头部疲惫微晃 + 手臂轻微抖动(加班太累)
    if (this.head) this.head.rotation.z = Math.sin(performance.now() * 0.004) * 0.05;
    if (this.armGroup) this.armGroup.rotation.z = Math.sin(performance.now() * 0.012) * 0.02;
    // 连点计数超时重置
    if (this.clickCount > 0 && performance.now() - this.lastClickTime > 2000) this.clickCount = 0;
  }

  _shoot(game, big) {
    const origin = this.mesh.position.clone();
    origin.x -= 0.85; origin.y = 0.95; // 朝左发射
    if (big) {
      const proj = new Projectile(game.grid.group, origin, this.cfg.chargeDamage * this.attackMul, 18, -1, true);
      proj.row = this.row;
      game.projectiles.push(proj);
    } else {
      const proj = new Projectile(game.grid.group, origin, this.cfg.damage * this.attackMul, 14, -1);
      proj.row = this.row;
      game.projectiles.push(proj);
    }
    game.playSound('shoot');
    this.body.position.x = big ? 0.15 : 0.08;
    this.muzzleFlash = big ? 0.35 : 0.18;
  }

  /** 开始蓄力 */
  startCharge(game) {
    if (this.charging) return;
    this.charging = true;
    this.chargeFx = 0;
  }

  /** 蓄力发射年终总结(大炮弹)，返回是否成功 */
  chargeShoot(game, chargeTime) {
    this.charging = false;
    if (chargeTime < 0.6) {
      this.chargeFx = 0;
      return false; // 蓄力不足
    }
    if (!game.resource.canAfford(this.cfg.chargeCost)) {
      game.toast('蓄力需要额外' + this.cfg.chargeCost + '摸鱼值！');
      this.chargeFx = 0;
      return false;
    }
    game.resource.spend(this.cfg.chargeCost);
    this._shoot(game, true);
    const p = this.mesh.position.clone(); p.y += 1.5;
    game.spawnFloatText(p, '年终总结！', '#ff8800');
    return true;
  }

  /** 彩蛋：连续点击10次发射空白PPT秒杀最弱僵尸 */
  onEggClick(game) {
    this.clickCount++;
    this.lastClickTime = performance.now();
    if (this.clickCount >= 10) {
      this.clickCount = 0;
      const alive = game.zombies.filter((z) => !z.dead).sort((a, b) => a.hp - b.hp);
      if (alive.length > 0) {
        alive[0].hp = 0;
        const p = alive[0].mesh.position.clone(); p.y += 1.5;
        game.spawnFloatText(p, '空白PPT秒杀！', '#ffffff');
        game.toast('空白PPT混过去了！秒杀最弱僵尸');
        game.playSound('die');
      } else {
        game.toast('没有僵尸可秒杀…');
      }
    } else {
      const p = this.mesh.position.clone(); p.y += 1.5;
      game.spawnFloatText(p, this.clickCount + '/10', '#aaccff');
    }
  }
}

/** 996坚果墙：圆胖坚果社畜，血量800，持续消耗摸鱼值，受伤出现裂纹+压扁+冒汗，重黑眼圈 */
export class Wallnut extends Plant {
  build() {
    const shellMat = new THREE.MeshLambertMaterial({ color: 0xb8863a });
    const shellDark = new THREE.MeshLambertMaterial({ color: 0x8a5e22 });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const ecMat = new THREE.MeshLambertMaterial({ color: 0x6b3a3a }); // 重黑眼圈

    // 主坚果球(保留 this.body 接口: material.color + scale.y)
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 18), shellMat);
    this.body.position.y = 0.55; this.body.castShadow = true;
    this.body.scale.set(1, 1.12, 0.92);
    this.mesh.add(this.body);
    // 底座(坐地感)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 16), shellDark);
    base.position.y = 0.06; this.mesh.add(base);

    // 坚果盖(顶部)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), capMat);
    cap.position.y = 0.55; this.mesh.add(cap);
    // 茎(小辫)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.18, 6), new THREE.MeshLambertMaterial({ color: 0x3a5a1a }));
    stem.position.set(0.05, 1.18, 0); stem.rotation.z = 0.2; this.mesh.add(stem);

    // 表情组(挂在 this.mesh,不随 body 压扁)
    const face = new THREE.Group(); face.position.y = 0.62; this.mesh.add(face);
    this.face = face;
    // 黑眼圈(重,996特供)
    const ecL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ecMat);
    ecL.scale.set(1, 0.75, 0.35); ecL.position.set(-0.15, 0.05, 0.42); face.add(ecL);
    const ecR = ecL.clone(); ecR.position.x = 0.15; face.add(ecR);
    // 眼白
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
    eL.scale.set(1, 0.7, 0.5); eL.position.set(-0.15, 0.05, 0.45); face.add(eL);
    const eR = eL.clone(); eR.position.x = 0.15; face.add(eR);
    // 瞳孔(无神向上看)
    const pMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), pMat);
    pL.position.set(-0.15, 0.1, 0.48); face.add(pL);
    const pR = pL.clone(); pR.position.x = 0.15; face.add(pR);
    // 眉毛(八字,痛苦)
    const browMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), browMat);
    browL.position.set(-0.15, 0.2, 0.46); browL.rotation.z = 0.25; face.add(browL);
    const browR = browL.clone(); browR.position.x = 0.15; browR.rotation.z = -0.25; face.add(browR);
    // 嘴(张嘴崩溃)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), darkMat);
    mouth.position.set(0, -0.18, 0.45); face.add(mouth);
    this.mouth = mouth;
    // 牙齿
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    tooth.position.set(0, -0.14, 0.47); face.add(tooth);

    // 裂纹(初始隐藏,受伤显现)
    this.cracks = [];
    const crackMat = new THREE.MeshLambertMaterial({ color: 0x2a1a08 });
    const crackDefs = [
      { p: [-0.25, 0.2, 0.38], r: [0, 0, 0.5], s: [0.3, 0.02, 0.02] },
      { p: [0.2, -0.1, 0.42], r: [0, 0, -0.8], s: [0.25, 0.02, 0.02] },
      { p: [0.05, 0.35, 0.4], r: [0, 0, 1.1], s: [0.22, 0.02, 0.02] },
      { p: [-0.1, -0.3, 0.4], r: [0, 0, 0.3], s: [0.2, 0.02, 0.02] },
      { p: [0.3, 0.25, 0.35], r: [0.3, 0, -0.5], s: [0.18, 0.02, 0.02] },
    ];
    for (const d of crackDefs) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(d.s[0], d.s[1], d.s[2]), crackMat);
      c.position.set(d.p[0], d.p[1], d.p[2]); c.rotation.set(d.r[0], d.r[1], d.r[2]);
      c.visible = false; face.add(c); this.cracks.push(c);
    }

    // 汗滴(头顶循环下落)
    this.sweats = [];
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x2266aa, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 })
      );
      s.scale.set(0.8, 1.3, 0.8);
      s.userData.phase = i * 0.5;
      this.mesh.add(s); this.sweats.push(s);
    }

    // 持续消耗摸鱼值计时器(996耗命)
    this.drainTimer = 0;
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.dead) return;

    // 持续消耗摸鱼值(996耗命)
    this.drainTimer += dt;
    if (this.drainTimer >= this.cfg.drainInterval) {
      this.drainTimer -= this.cfg.drainInterval;
      if (game.resource.canAfford(this.cfg.drain)) {
        game.resource.spend(this.cfg.drain);
      } else {
        // 摸鱼值不足，枯萎消失
        this.dead = true;
        game.toast('996坚果墙过劳枯萎了…摸鱼值不足！');
        return;
      }
    }

    // 裂纹效果：血量越低越暗 + 压扁 + 裂纹显现 + 冒汗加速
    const ratio = this.hp / this.maxHp;
    // 变色(分段)
    let col;
    if (ratio > 0.66) col = 0xb8863a;
    else if (ratio > 0.33) col = 0x9a6e2a;
    else col = 0x7a521e;
    this.body.material.color.setHex(col);
    // 压扁
    const targetY = ratio < 0.33 ? Math.max(0.62, ratio * 2.2) : 1.12;
    this.body.scale.y += (targetY - this.body.scale.y) * Math.min(1, dt * 6);
    // 倾斜(越伤越歪)
    this.body.rotation.z = (1 - ratio) * 0.12 * Math.sin(performance.now() * 0.003);
    // 裂纹显现
    const crackThresholds = [0.75, 0.6, 0.45, 0.3, 0.15];
    for (let i = 0; i < this.cracks.length; i++) {
      this.cracks[i].visible = ratio < crackThresholds[i];
    }
    // 嘴张大(越伤越大)
    if (this.mouth) this.mouth.scale.y = 1 + (1 - ratio) * 1.2;
    // 汗滴循环下落(越伤越快)
    const sweatSpeed = 0.6 + (1 - ratio) * 1.6;
    const period = 1.4;
    for (const s of this.sweats) {
      const t = ((performance.now() * 0.001 * sweatSpeed) + s.userData.phase) % period;
      s.position.set(0.32, 1.15 - t * 0.9, 0.1);
      s.material.opacity = t < period - 0.2 ? 0.85 : 0;
      s.visible = ratio < 0.85;
    }
  }

  /** 彩蛋：点击喊"福报！"+无敌1秒 */
  onEggClick(game) {
    this.invincible = 1;
    const p = this.mesh.position.clone(); p.y += 1.8;
    game.spawnFloatText(p, '福报！', '#ff5d6c');
    game.toast('996是福报！坚果墙无敌1秒');
    game.playSound('plant');
  }
}

/** 工厂：根据类型创建植物实例 */
export function createPlant(scene, type, row, col, grid) {
  switch (type) {
    case 'sunflower':  return new Sunflower(scene, type, row, col, grid);
    case 'peashooter': return new Peashooter(scene, type, row, col, grid);
    case 'wallnut':    return new Wallnut(scene, type, row, col, grid);
    default: return null;
  }
}
