import * as THREE from 'three';
import { Plant } from './Plant.js';

/**
 * 996坚果墙：圆胖坚果社畜，血量800，持续消耗摸鱼值，受伤出现裂纹+压扁+冒汗，重黑眼圈
 * 从 Plant.js 提取。
 */
export class Wallnut extends Plant {
  build() {
    const shellMat = new THREE.MeshLambertMaterial({ color: 0xb8863a });
    const shellDark = new THREE.MeshLambertMaterial({ color: 0x8a5e22 });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x5a3a18 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const ecMat = new THREE.MeshLambertMaterial({ color: 0x6b3a3a });

    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 18), shellMat);
    this.body.position.y = 0.55; this.body.castShadow = true;
    this.body.scale.set(1, 1.12, 0.92);
    this.mesh.add(this.body);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 16), shellDark);
    base.position.y = 0.06; this.mesh.add(base);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), capMat);
    cap.position.y = 0.55; this.mesh.add(cap);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.18, 6), new THREE.MeshLambertMaterial({ color: 0x3a5a1a }));
    stem.position.set(0.05, 1.18, 0); stem.rotation.z = 0.2; this.mesh.add(stem);

    const face = new THREE.Group(); face.position.y = 0.62; this.mesh.add(face);
    this.face = face;
    const ecL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), ecMat);
    ecL.scale.set(1, 0.75, 0.35); ecL.position.set(-0.15, 0.05, 0.42); face.add(ecL);
    const ecR = ecL.clone(); ecR.position.x = 0.15; face.add(ecR);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeMat);
    eL.scale.set(1, 0.7, 0.5); eL.position.set(-0.15, 0.05, 0.45); face.add(eL);
    const eR = eL.clone(); eR.position.x = 0.15; face.add(eR);
    const pMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), pMat);
    pL.position.set(-0.15, 0.1, 0.48); face.add(pL);
    const pR = pL.clone(); pR.position.x = 0.15; face.add(pR);
    const browMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.03), browMat);
    browL.position.set(-0.15, 0.2, 0.46); browL.rotation.z = 0.25; face.add(browL);
    const browR = browL.clone(); browR.position.x = 0.15; browR.rotation.z = -0.25; face.add(browR);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), darkMat);
    mouth.position.set(0, -0.18, 0.45); face.add(mouth);
    this.mouth = mouth;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    tooth.position.set(0, -0.14, 0.47); face.add(tooth);

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

    this.drainTimer = 0;
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.dead) return;

    this.drainTimer += dt;
    if (this.drainTimer >= this.cfg.drainInterval) {
      this.drainTimer -= this.cfg.drainInterval;
      if (game.resource.canAfford(this.cfg.drain)) {
        game.resource.spend(this.cfg.drain);
      } else {
        this.dead = true;
        game.toast('996坚果墙过劳枯萎了…摸鱼值不足！');
        return;
      }
    }

    const ratio = this.hp / this.maxHp;
    let col;
    if (ratio > 0.66) col = 0xb8863a;
    else if (ratio > 0.33) col = 0x9a6e2a;
    else col = 0x7a521e;
    this.body.material.color.setHex(col);
    const targetY = ratio < 0.33 ? Math.max(0.62, ratio * 2.2) : 1.12;
    this.body.scale.y += (targetY - this.body.scale.y) * Math.min(1, dt * 6);
    this.body.rotation.z = (1 - ratio) * 0.12 * Math.sin(performance.now() * 0.003);
    const crackThresholds = [0.75, 0.6, 0.45, 0.3, 0.15];
    for (let i = 0; i < this.cracks.length; i++) {
      this.cracks[i].visible = ratio < crackThresholds[i];
    }
    if (this.mouth) this.mouth.scale.y = 1 + (1 - ratio) * 1.2;
    const sweatSpeed = 0.6 + (1 - ratio) * 1.6;
    const period = 1.4;
    for (const s of this.sweats) {
      const t = ((performance.now() * 0.001 * sweatSpeed) + s.userData.phase) % period;
      s.position.set(0.32, 1.15 - t * 0.9, 0.1);
      s.material.opacity = t < period - 0.2 ? 0.85 : 0;
      s.visible = ratio < 0.85;
    }
  }

  onEggClick(game) {
    this.invincible = 1;
    const p = this.mesh.position.clone(); p.y += 1.8;
    game.effects.spawnFloatText(game.grid.group, p, '福报！', '#ff5d6c');
    game.toast('996是福报！坚果墙无敌1秒');
    game.audio.play('plant');
  }
}
