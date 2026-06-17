import * as THREE from 'three';
import { Plant } from './Plant.js';
import { Projectile } from './Projectile.js';

/**
 * 行政流程审批员：手持红色公章，发射"审批单"子弹。
 * 命中僵尸造成伤害并减速50%持续3秒。
 * 含抗性衰减：同一僵尸连续减速超15秒后减速效果衰减为一半(防无限控死Boss)。
 */
export class Auditor extends Plant {
  build() {
    const suitMat = new THREE.MeshLambertMaterial({ color: 0x1a3a5a }); // 深蓝行政夹克
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd2b8 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x661111, emissiveIntensity: 0.3 });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });

    // 主体容器(盖章后坐力)
    this.body = new THREE.Group();
    this.body.position.y = 0.55;
    this.mesh.add(this.body);
    this.muzzleFlash = 0;

    // 躯干(行政夹克)
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), suitMat);
    torso.scale.set(1, 1.05, 0.92); torso.castShadow = true;
    this.body.add(torso);
    // 胸前工牌
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.02), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    badge.position.set(0.1, 0.02, 0.22); this.body.add(badge);
    const badgeStrap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.01), darkMat);
    badgeStrap.position.set(0.1, 0.18, 0.21); this.body.add(badgeStrap);

    // 头部
    const head = new THREE.Group(); head.position.set(0, 0.44, 0.03); this.body.add(head);
    this.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 16), skinMat);
    skull.castShadow = true; head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
    jaw.position.set(0, -0.14, 0.02); jaw.scale.set(1, 0.7, 0.9); head.add(jaw);
    // 头发(三七分，标准体制内发型)
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.268, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    head.add(hair);
    // 眼睛
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), eyeMat);
    eL.scale.set(1, 0.6, 0.5); eL.position.set(-0.08, 0.0, 0.22); head.add(eL);
    const eR = eL.clone(); eR.position.x = 0.08; head.add(eR);
    const pMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), pMat);
    pL.position.set(-0.08, 0.0, 0.245); head.add(pL);
    const pR = pL.clone(); pR.position.x = 0.08; head.add(pR);
    // 方框眼镜(体制内标配)
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const glL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.01), frameMat);
    glL.position.set(-0.08, 0.0, 0.24); head.add(glL);
    const glR = glL.clone(); glR.position.x = 0.08; head.add(glR);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), frameMat);
    bridge.position.set(0, 0.0, 0.245); head.add(bridge);
    // 嘴(严肃一字嘴)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.015, 0.03), darkMat);
    mouth.position.set(0, -0.14, 0.22); head.add(mouth);

    // 手臂高举公章(朝 -x 方向，僵尸从左来袭)
    const armGroup = new THREE.Group(); armGroup.position.set(-0.18, 0.18, 0.05); armGroup.rotation.y = Math.PI; this.body.add(armGroup);
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.11), suitMat);
    upperArm.position.set(0.15, 0, 0); upperArm.castShadow = true; armGroup.add(upperArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
    hand.position.set(0.32, 0, 0); armGroup.add(hand);

    // 红色公章(圆柱体印章)
    const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 12), redMat);
    stamp.rotation.z = Math.PI / 2; stamp.position.set(0.45, 0, 0); armGroup.add(stamp);
    // 印章底面(金色刻字面)
    const stampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 12), goldMat);
    stampBase.rotation.z = Math.PI / 2; stampBase.position.set(0.55, 0, 0); armGroup.add(stampBase);
    this.armGroup = armGroup;
    this.stamp = stamp;
  }

  behavior(dt, game) {
    const interval = this.cfg.fireInterval / (this.fireRateMul || 1);
    // 甩锅闪腰期间不攻击
    if (game.items && game.items.isPlantStopped()) return;
    if (this.timer >= interval) {
      if (game.hasZombieAhead(this.row, this.mesh.position.x)) {
        this.timer = 0;
        this._shoot(game);
      }
    }
    this.body.position.x += (0 - this.body.position.x) * Math.min(1, dt * 10);
    // 盖章动画：手臂下压后回弹
    if (this.armGroup) {
      const f = Math.max(0, this.muzzleFlash);
      this.armGroup.rotation.x = f * 0.8;
      if (f > 0) this.muzzleFlash = f - dt;
    }
    // 公章红色发光呼吸
    if (this.stamp) {
      this.stamp.material.emissiveIntensity = 0.2 + Math.sin(performance.now() * 0.005) * 0.15;
    }
    // 头部微晃(审批很累)
    if (this.head) this.head.rotation.z = Math.sin(performance.now() * 0.003) * 0.03;
  }

  _shoot(game) {
    const origin = this.mesh.position.clone();
    origin.x -= 0.85; origin.y = 0.95;
    // 发射审批单弹丸(普通伤害+减速标记)
    const proj = new Projectile(game.grid.group, origin, this.cfg.damage * this.attackMul, 13, -1);
    proj.row = this.row;
    proj.isApproval = true; // 标记为审批单(带减速效果)
    proj.slowMul = this.cfg.slowMul;
    proj.slowDuration = this.cfg.slowDuration;
    game.projectiles.push(proj);
    game.audio.play('shoot');
    // 盖章后坐力
    this.body.position.x = 0.1;
    this.muzzleFlash = 0.25;
  }
}
