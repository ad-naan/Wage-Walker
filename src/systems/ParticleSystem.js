import * as THREE from 'three';

/**
 * 粒子系统：管理种植/死亡/大招等粒子特效的生成与更新。
 * 从 main.js 提取。所有粒子挂载到 grid.group 以跟随棋盘偏移。
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  /** 种植绿色圆环扩散 */
  spawnPlant(group, pos) {
    const N = 24;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = 0.3;
      positions[i * 3 + 2] = pos.z;
      const a = (i / N) * Math.PI * 2;
      const sp = 1.5 + Math.random() * 0.8;
      velocities.push(new THREE.Vector3(Math.cos(a) * sp, 1.2 + Math.random(), Math.sin(a) * sp));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x6fff5a, size: 0.22, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    this.particles.push({ points, velocities, life: 0.8, maxLife: 0.8, gravity: -3 });
  }

  /** 死亡灰色方块爆裂 */
  spawnDeath(group, pos) {
    const N = 18;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = 0.6;
      positions[i * 3 + 2] = pos.z;
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 2,
        (Math.random() - 0.5) * 4
      ));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9a9a9a, size: 0.26, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    this.particles.push({ points, velocities, life: 0.7, maxLife: 0.7, gravity: -6 });
  }

  /** 甩锅大会紫色全屏扩散 */
  spawnUlt(group) {
    const N = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(N * 3);
    const velocities = [];
    for (let i = 0; i < N; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0.5;
      positions[i * 3 + 2] = 0;
      const a = (i / N) * Math.PI * 2;
      const sp = 3 + Math.random() * 2;
      velocities.push(new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 2, Math.sin(a) * sp));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff66ff, size: 0.3, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    group.add(points);
    this.particles.push({ points, velocities, life: 1.0, maxLife: 1.0, gravity: -4 });
  }

  /** 金币收集粒子(向日葵点击反馈) */
  spawnCoin(group, pos) {
    const N = 8;
    for (let i = 0; i < N; i++) {
      const geo = new THREE.SphereGeometry(0.08, 6, 5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 1 });
      const coin = new THREE.Mesh(geo, mat);
      coin.position.set(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.2, pos.z + (Math.random() - 0.5) * 0.3);
      group.add(coin);
      const vx = (Math.random() - 0.5) * 2;
      const vy = 1.5 + Math.random() * 1.5;
      const vz = (Math.random() - 0.5) * 2;
      this.particles.push({ points: coin, velocities: [new THREE.Vector3(vx, vy, vz)], life: 0.6, maxLife: 0.6, gravity: -5, isMesh: true });
    }
  }

  update(dt, group) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.isMesh) {
        // 网格粒子(金币等)
        const v = pt.velocities[0];
        v.y += pt.gravity * dt;
        pt.points.position.x += v.x * dt;
        pt.points.position.y += v.y * dt;
        pt.points.position.z += v.z * dt;
        pt.points.material.opacity = Math.max(0, pt.life / pt.maxLife);
        pt.points.scale.setScalar(Math.max(0.1, pt.life / pt.maxLife));
        if (pt.life <= 0) {
          group.remove(pt.points);
          if (pt.points.geometry) pt.points.geometry.dispose();
          if (pt.points.material) pt.points.material.dispose();
          this.particles.splice(i, 1);
        }
      } else {
        // 点粒子(默认)
        const arr = pt.points.geometry.attributes.position.array;
        for (let j = 0; j < pt.velocities.length; j++) {
          const v = pt.velocities[j];
          v.y += pt.gravity * dt;
          arr[j * 3] += v.x * dt;
          arr[j * 3 + 1] += v.y * dt;
          arr[j * 3 + 2] += v.z * dt;
        }
        pt.points.geometry.attributes.position.needsUpdate = true;
        pt.points.material.opacity = Math.max(0, pt.life / pt.maxLife);
        if (pt.life <= 0) {
          group.remove(pt.points);
          pt.points.geometry.dispose();
          pt.points.material.dispose();
          this.particles.splice(i, 1);
        }
      }
    }
  }

  clear(group) {
    for (const pt of this.particles) group.remove(pt.points);
    this.particles = [];
  }
}
