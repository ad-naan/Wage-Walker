import * as THREE from 'three';
import { Plant } from './Plant.js';
import { Projectile } from './Projectile.js';

/**
 * PPT豌豆射手：疲惫社畜举激光笔，发射 Word 文档弹丸，伤害20，攻速1.4s；长按蓄力发射年终总结
 * 从 Plant.js 提取。
 */
export class Peashooter extends Plant {
  build() {
    const suitMat = new THREE.MeshLambertMaterial({ color: 0x2a4a8a });
    const suitDark = new THREE.MeshLambertMaterial({ color: 0x1a3060 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd2b8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x2a1a14 });
    const ecMat = new THREE.MeshLambertMaterial({ color: 0x7a5a5a });

    this.body = new THREE.Group();
    this.body.position.y = 0.55;
    this.mesh.add(this.body);
    this.muzzleFlash = 0;
    this.charging = false;
    this.chargeFx = 0;
    this.clickCount = 0;
    this.lastClickTime = 0;

    // 躯干
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), suitMat);
    torso.scale.set(1, 1.08, 0.92); torso.castShadow = true;
    this.body.add(torso);
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
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
    jaw.position.set(0, -0.14, 0.02); jaw.scale.set(1, 0.7, 0.9); head.add(jaw);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.268, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    head.add(hair);
    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMat);
    earL.scale.set(0.5, 1, 1); earL.position.set(-0.25, -0.02, 0); head.add(earL);
    const earR = earL.clone(); earR.position.x = 0.25; head.add(earR);
    const ecL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), ecMat);
    ecL.scale.set(1, 0.62, 0.4); ecL.position.set(-0.09, -0.01, 0.21); head.add(ecL);
    const ecR = ecL.clone(); ecR.position.x = 0.09; head.add(ecR);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
    eL.scale.set(1, 0.55, 0.5); eL.position.set(-0.09, 0.0, 0.225); head.add(eL);
    const eR = eL.clone(); eR.position.x = 0.09; head.add(eR);
    const pMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), pMat);
    pL.position.set(-0.09, -0.015, 0.245); head.add(pL);
    const pR = pL.clone(); pR.position.x = 0.09; head.add(pR);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const glL = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.01, 6, 16), frameMat);
    glL.position.set(-0.09, 0.0, 0.235); head.add(glL);
    const glR = glL.clone(); glR.position.x = 0.09; head.add(glR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.03), frameMat);
    bridge.position.set(0, 0.0, 0.245); head.add(bridge);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.03), darkMat);
    mouth.position.set(0, -0.16, 0.22); head.add(mouth);

    // 手臂前伸举激光笔
    const armGroup = new THREE.Group(); armGroup.position.set(-0.18, 0.18, 0.05); armGroup.rotation.y = Math.PI; this.body.add(armGroup);
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), suitMat);
    upperArm.position.set(0.17, 0, 0); upperArm.castShadow = true; armGroup.add(upperArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
    hand.position.set(0.36, 0, 0); armGroup.add(hand);
    const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 10), suitDark);
    laser.rotation.z = Math.PI / 2; laser.position.set(0.5, 0, 0); armGroup.add(laser);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), new THREE.MeshLambertMaterial({ color: 0xffd700 }));
    clip.position.set(0.48, 0.05, 0); armGroup.add(clip);
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
      if (game.hasZombieAhead(this.row, this.mesh.position.x)) {
        this.timer = 0;
        this._shoot(game, false);
      }
    }
    this.body.position.x += (0 - this.body.position.x) * Math.min(1, dt * 10);
    if (this.muzzle) {
      const f = Math.max(0, this.muzzleFlash);
      this.muzzle.material.emissiveIntensity = 0.25 + f * 5;
      this.muzzle.scale.setScalar(1 + f * 1.2);
      if (f > 0) this.muzzleFlash = f - dt;
    }
    if (this.charging) {
      this.chargeFx = Math.min(1, this.chargeFx + dt * 0.8);
      if (this.muzzle) {
        this.muzzle.material.emissiveIntensity = 0.25 + this.chargeFx * 8;
        this.muzzle.scale.setScalar(1 + this.chargeFx * 2.5);
      }
    } else {
      this.chargeFx = 0;
    }
    if (this.head) this.head.rotation.z = Math.sin(performance.now() * 0.004) * 0.05;
    if (this.armGroup) this.armGroup.rotation.z = Math.sin(performance.now() * 0.012) * 0.02;
    if (this.clickCount > 0 && performance.now() - this.lastClickTime > 2000) this.clickCount = 0;
  }

  _shoot(game, big) {
    const origin = this.mesh.position.clone();
    origin.x -= 0.85; origin.y = 0.95;
    if (big) {
      const proj = new Projectile(game.grid.group, origin, this.cfg.chargeDamage * this.attackMul, 18, -1, true);
      proj.row = this.row;
      game.projectiles.push(proj);
    } else {
      const proj = new Projectile(game.grid.group, origin, this.cfg.damage * this.attackMul, 14, -1);
      proj.row = this.row;
      game.projectiles.push(proj);
    }
    game.audio.play('shoot');
    this.body.position.x = big ? 0.15 : 0.08;
    this.muzzleFlash = big ? 0.35 : 0.18;
  }

  startCharge() {
    if (this.charging) return;
    this.charging = true;
    this.chargeFx = 0;
  }

  chargeShoot(game, chargeTime) {
    this.charging = false;
    if (chargeTime < 0.6) { this.chargeFx = 0; return false; }
    if (!game.resource.canAfford(this.cfg.chargeCost)) {
      game.toast('蓄力需要额外' + this.cfg.chargeCost + '摸鱼值！');
      this.chargeFx = 0;
      return false;
    }
    game.resource.spend(this.cfg.chargeCost);
    this._shoot(game, true);
    const p = this.mesh.position.clone(); p.y += 1.5;
    game.effects.spawnFloatText(game.grid.group, p, '年终总结！', '#ff8800');
    return true;
  }

  onEggClick(game) {
    this.clickCount++;
    this.lastClickTime = performance.now();
    if (this.clickCount >= 10) {
      this.clickCount = 0;
      const alive = game.zombies.filter((z) => !z.dead).sort((a, b) => a.hp - b.hp);
      if (alive.length > 0) {
        alive[0].hp = 0;
        const p = alive[0].mesh.position.clone(); p.y += 1.5;
        game.effects.spawnFloatText(game.grid.group, p, '空白PPT秒杀！', '#ffffff');
        game.toast('空白PPT混过去了！秒杀最弱僵尸');
        game.audio.play('die');
      } else {
        game.toast('没有僵尸可秒杀…');
      }
    } else {
      const p = this.mesh.position.clone(); p.y += 1.5;
      game.effects.spawnFloatText(game.grid.group, p, this.clickCount + '/10', '#aaccff');
    }
  }
}
