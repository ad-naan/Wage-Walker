import * as THREE from 'three';

/**
 * 弹丸：PPT豌豆射手发射的"Word文档"。
 * 按 dirX 方向匀速飞行(默认 +x)，命中同行僵尸后造成伤害。
 */
export class Projectile {
  constructor(scene, origin, damage = 20, speed = 14, dirX = 1) {
    this.scene = scene;
    this.damage = damage;
    this.speed = speed;
    this.dirX = dirX; // +1 向右, -1 向左
    this.row = null;
    this.dead = false;

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

    scene.add(this.mesh);
  }

  update(dt) {
    this.mesh.position.x += this.speed * this.dirX * dt;
    this.mesh.rotation.z += dt * 7 * this.dirX;
    this.mesh.position.y = 0.85 + Math.sin(performance.now() * 0.02) * 0.04;
  }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    this.dead = true;
  }
}
