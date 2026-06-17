import * as THREE from 'three';

/**
 * 植物配置表
 * cost 摸鱼值消耗; hp 血量; cd 卡片冷却(秒)
 * isSkill=技能类(主动道具); isUlt=大招(消耗怨气值); isTicket=消耗工时券
 */
export const PLANT_TYPES = {
  // ===== 植物 =====
  sunflower:  { name: '向日葵社畜',   cost: 20,  hp: 120, icon: '🌻', cd: 5,
                produce: 30, produceInterval: 4, clickGain: 5 },
  peashooter: { name: 'PPT豌豆射手', cost: 100, hp: 120, icon: '📄', cd: 5,
                damage: 20, fireInterval: 1.4, chargeDamage: 80, chargeCost: 50 },
  wallnut:    { name: '996坚果墙',   cost: 50,  hp: 800, icon: '🥜', cd: 20,
                drain: 10, drainInterval: 60 },
  auditor:    { name: '行政审批员',   cost: 75,  hp: 120, icon: '公章', cd: 8,
                damage: 15, fireInterval: 1.6, slowMul: 0.5, slowDuration: 3 },

  // ===== 第一类：攻击/清场型 =====
  hammer:     { name: '换鱼锤',     cost: 20,  hp: 0, icon: '🔨', cd: 12, isSkill: true },
  shield:     { name: '甩锅盾牌',   cost: 80,  hp: 0, icon: '🛡️', cd: 25, isSkill: true },
  read:       { name: '已读不回',   cost: 30,  hp: 0, icon: '气泡', cd: 18, isSkill: true },
  photo:      { name: '团建大合照', cost: 150, hp: 0, icon: '📷', cd: 45, isSkill: true },

  // ===== 第二类：战术陷阱/防御型 =====
  mine:       { name: '带薪拉屎地雷', cost: 40, hp: 0, icon: '💩', cd: 20, isSkill: true },
  tiaoxiu:    { name: '调休单护盾',   cost: 60, hp: 0, icon: '📋', cd: 22, isSkill: true },
  dabing:     { name: '大饼诱饵',     cost: 10, hp: 0, icon: '🥞', cd: 12, isSkill: true },

  // ===== 第三类：增益/Buff类 =====
  coffee:     { name: '续命咖啡',     cost: 100, hp: 0, icon: '☕', cd: 35, isSkill: true },
  report:     { name: '日报自动生成器', cost: 50, hp: 0, icon: '📰', cd: 30, isSkill: true },
  optimize:   { name: '反向优化',     cost: 120, hp: 0, icon: '⚙️', cd: 40, isSkill: true },

  // ===== 第四类：终极技能(消耗怨气值) =====
  ult_moyu:   { name: '终极摸鱼',   cost: 0, hp: 0, icon: '😎', cd: 0, isUlt: true, rageCost: 100 },
  ult_meeting:{ name: '紧急会议',   cost: 0, hp: 0, icon: '📢', cd: 0, isUlt: true, rageCost: 100 },
  ult_bomb:   { name: '钉钉轰炸',   cost: 0, hp: 0, icon: '💣', cd: 0, isUlt: true, rageCost: 100 },

  // ===== 第五类：工时券消耗品 =====
  weather:    { name: '天气之子',   cost: 0, hp: 0, icon: '🌧️', cd: 0, isTicket: true, ticketCost: 1 },
  readback:   { name: '已读乱回',   cost: 0, hp: 0, icon: '🗨️', cd: 0, isTicket: true, ticketCost: 2 },
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
