import * as THREE from 'three';
import { Plant } from './Plant.js';

/**
 * 向日葵社畜：产出摸鱼值，附带"抖腿"待机动画；点击额外产出(有老板路过风险)
 * 从 Plant.js 提取。
 */
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
      const mul = game.moyuMul || 1;
      const amount = Math.round(this.cfg.produce * mul);
      game.resource.add(amount);
      const p = this.mesh.position.clone(); p.y += 1.4;
      game.effects.spawnFloatText(game.grid.group, p, '+' + amount, '#ffd34d');
      game.audio.play('produce');
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
    game.effects.spawnFloatText(game.grid.group, p, '+' + amount, '#ffd34d');
    game.audio.play('produce');
    this.head.scale.setScalar(1.2);
  }
}
