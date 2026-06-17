import * as THREE from 'three';

/**
 * 弹丸：PPT豌豆射手发射的"Word文档"。
 * 按 dirX 方向匀速飞行(默认 +x)，命中同行僵尸后造成伤害。
 * big=true 时为"年终总结"大炮弹：更大、伤害更高、带金色光效。
 */
export class Projectile {
  constructor(scene, origin, damage = 20, speed = 14, dirX = 1, big = false) {
    this.scene = scene;
    this.damage = damage;
    this.speed = speed;
    this.dirX = dirX; // +1 向右, -1 向左
    this.row = null;
    this.dead = false;
    this.big = big;
    this.isApproval = false; // 审批单弹丸(带减速效果)
    this.slowMul = 0.5;
    this.slowDuration = 3;

    if (big) {
      // 年终总结大炮弹：金色大方块 + 标题贴图
      const geo = new THREE.BoxGeometry(0.6, 0.7, 0.2);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffd700, emissive: 0xff8800, emissiveIntensity: 0.35, roughness: 0.4,
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.copy(origin);
      this.mesh.position.y = 0.95;
      this.mesh.castShadow = true;

      // "年终总结"文字贴图
      const tex = this._makeTextTexture('年终\n总结', '#1a1a1a');
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      label.position.z = 0.11;
      this.mesh.add(label);
      const label2 = label.clone();
      label2.position.z = -0.11;
      label2.rotation.y = Math.PI;
      this.mesh.add(label2);
    } else {
      // 白色"文档"方块 + 折角细节
      const geo = new THREE.BoxGeometry(0.32, 0.42, 0.12);
      const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.copy(origin);
      this.mesh.position.y = 0.85;
      this.mesh.castShadow = true;

      // 文档折角(随方向镜像)
      const fold = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.13),
        new THREE.MeshLambertMaterial({ color: 0xcccccc })
      );
      fold.position.set(0.11 * dirX, 0.16, 0);
      this.mesh.add(fold);
    }

    scene.add(this.mesh);
  }

  _makeTextTexture(text, color) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,215,0,0)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = color;
    ctx.font = 'bold 38px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 64, 50 + i * 40);
    });
    return new THREE.CanvasTexture(c);
  }

  update(dt) {
    this.mesh.position.x += this.speed * this.dirX * dt;
    this.mesh.rotation.z += dt * 7 * this.dirX;
    const baseY = this.big ? 0.95 : 0.85;
    this.mesh.position.y = baseY + Math.sin(performance.now() * 0.02) * 0.04;
  }

  destroy() {
    this.scene.remove(this.mesh);
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
