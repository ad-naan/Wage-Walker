import * as THREE from 'three';

/**
 * 网格系统：生成 5x9 草地棋盘，处理 行/列 <-> 世界坐标 转换，管理地块占用。
 * 约定：左侧(col<0)为房区僵尸生成点，右侧(col>=cols)为玩家工位基地。
 *       僵尸向 +x 方向(向右)移动进攻基地。
 */
export class GridSystem {
  constructor(scene, rows = 5, cols = 9, cell = 2) {
    this.scene = scene;
    this.rows = rows;
    this.cols = cols;
    this.cell = cell;
    this.group = new THREE.Group();
    // 整体偏移(轻微俯视视角)
    this.group.position.set(0, 0, 0);
    this.scene.add(this.group);
    this.tiles = []; // tiles[r][c] = { mesh, occupied, baseColor }
    this.buildGrid();
    this.buildLandmarks();
  }

  buildGrid() {
    for (let r = 0; r < this.rows; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < this.cols; c++) {
        const pos = this.gridToWorld(r, c);
        const geo = new THREE.BoxGeometry(this.cell * 1.0, 0.2, this.cell * 1.0);
        const color = (r + c) % 2 === 0 ? 0x5fa84a : 0x4f9a3a;
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, -0.1, pos.z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        mesh.userData = { row: r, col: c, isTile: true };
        this.group.add(mesh);
        this.tiles[r][c] = { mesh, occupied: null, baseColor: color };

        // 格子间的缝隙(深色线条，增强棋盘感)
        if (c < this.cols - 1) {
          const gapGeo = new THREE.BoxGeometry(0.03, 0.22, this.cell * 1.0);
          const gapMat = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
          const gap = new THREE.Mesh(gapGeo, gapMat);
          const nx = this.gridToWorld(r, c + 1);
          gap.position.set(nx.x - this.cell * 0.5, -0.1, nx.z);
          this.group.add(gap);
        }
        if (r < this.rows - 1) {
          const gapGeo = new THREE.BoxGeometry(this.cell * 1.0, 0.22, 0.03);
          const gapMat = new THREE.MeshLambertMaterial({ color: 0x2a3a1a });
          const gap = new THREE.Mesh(gapGeo, gapMat);
          const nz = this.gridToWorld(r + 1, c);
          gap.position.set(nz.x, -0.1, nz.z + this.cell * 0.5);
          this.group.add(gap);
        }
      }
    }

    // 棋盘外边缘围挡(草地下的土堤)
    const halfW = (this.cols * this.cell) / 2 + 0.15;
    const halfD = (this.rows * this.cell) / 2 + 0.15;
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
    // 前后面
    for (let side = -1; side <= 1; side += 2) {
      const wallGeo = new THREE.BoxGeometry(halfW * 2 + 0.3, 0.35, 0.3);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(0, -0.25, side * halfD);
      wall.receiveShadow = true;
      this.group.add(wall);
    }
    // 左右面
    for (let side = -1; side <= 1; side += 2) {
      const wallGeo = new THREE.BoxGeometry(0.3, 0.35, this.rows * this.cell + 0.3);
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(side * halfW, -0.25, 0);
      wall.receiveShadow = true;
      this.group.add(wall);
    }
  }

  // 左侧房区(僵尸生成点) 与 右侧工位(玩家基地) 装饰
  buildLandmarks() {
    const left = this.gridToWorld(0, -1).x;
    const right = this.gridToWorld(0, this.cols).x;
    const totalLen = this.rows * this.cell;

    // 左侧房区：暗红色长条 + 稍微抬高
    const houseGeo = new THREE.BoxGeometry(this.cell * 1.2, 0.5, totalLen + 0.5);
    const houseMat = new THREE.MeshLambertMaterial({ color: 0x8a3a3a });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(left, 0.1, 0);
    house.receiveShadow = true;
    house.castShadow = true;
    this.group.add(house);

    // 房区装饰：小房子剪影
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * (totalLen / 3);
      const buildGeo = new THREE.BoxGeometry(this.cell * 0.8, 1.5, this.cell * 0.8);
      const buildMat = new THREE.MeshLambertMaterial({ color: 0x5a2a2a });
      const building = new THREE.Mesh(buildGeo, buildMat);
      building.position.set(left, 0.75, z);
      building.castShadow = true;
      this.group.add(building);
      // 屋顶
      const roofGeo = new THREE.ConeGeometry(this.cell * 0.6, 0.6, 4);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a1a1a });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(left, 1.8, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.group.add(roof);
    }

    // 右侧工位：蓝灰色长条 + 稍微抬高
    const baseGeo = new THREE.BoxGeometry(this.cell * 1.2, 0.5, totalLen + 0.5);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(right, 0.1, 0);
    base.receiveShadow = true;
    base.castShadow = true;
    this.group.add(base);

    // 工位装饰：电脑桌
    for (let r = 0; r < this.rows; r++) {
      const z = this.gridToWorld(r, 0).z;
      // 桌子
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.6, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x5a6a8a })
      );
      desk.position.set(right + 0.3, 0.3, z);
      desk.castShadow = true;
      desk.receiveShadow = true;
      this.group.add(desk);
      // 显示器
      const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x2a3a5a })
      );
      monitor.position.set(right + 0.3, 0.85, z);
      monitor.castShadow = true;
      this.group.add(monitor);
      // 屏幕光
      const screenGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x4a90d9 })
      );
      screenGlow.position.set(right + 0.3, 0.85, z + 0.03);
      this.group.add(screenGlow);
    }
  }

  /** 行列 -> 世界坐标 (格子中心, y=0) */
  gridToWorld(row, col) {
    const x = (col - (this.cols - 1) / 2) * this.cell;
    const z = (row - (this.rows - 1) / 2) * this.cell;
    return new THREE.Vector3(x, 0, z);
  }

  /** 世界坐标 -> 行列 (越界返回 null) */
  worldToGrid(point) {
    const col = Math.round(point.x / this.cell + (this.cols - 1) / 2);
    const row = Math.round(point.z / this.cell + (this.rows - 1) / 2);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return { row, col };
  }

  /** 基地(工位)的 x 坐标，僵尸越过即扣血 */
  getBaseX() {
    return this.gridToWorld(0, this.cols - 1).x + this.cell * 0.9;
  }

  /** 僵尸生成点 x (左侧外) */
  getSpawnX() {
    return this.gridToWorld(0, -1).x;
  }

  isOccupied(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
    return this.tiles[row][col].occupied != null;
  }

  setOccupied(row, col, obj) {
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.tiles[row][col].occupied = obj;
    }
  }

  getTile(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.tiles[row][col];
  }

  highlight(row, col, on) {
    const t = this.getTile(row, col);
    if (!t) return;
    t.mesh.material.color.setHex(on ? 0x9fff6a : t.baseColor);
  }

  /** 提供给 Raycaster 检测的地块网格列表 */
  getTileMeshes() {
    const list = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) list.push(this.tiles[r][c].mesh);
    return list;
  }
}
