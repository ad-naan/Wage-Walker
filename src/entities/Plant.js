import * as THREE from 'three';

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
      this.applyColorTint(0xffe066);
    } else {
      this.applyColorTint(null);
    }
  }

  idle() {
    const t = performance.now() * 0.003;
    this.mesh.position.y = Math.sin(t + this.col) * 0.08;
    this.mesh.rotation.z = Math.sin(t * 0.7 + this.row) * 0.04;
  }

  behavior(dt, game) {}

  takeDamage(d) {
    if (this.invincible > 0) return;
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
