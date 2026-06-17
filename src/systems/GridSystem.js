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
        const geo = new THREE.BoxGeometry(this.cell * 0.98, 0.2, this.cell * 0.98);
        const color = (r + c) % 2 === 0 ? 0x5fa84a : 0x4f9a3a;
        const mat = new THREE.MeshLambertMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, -0.1, pos.z);
        mesh.receiveShadow = true;
        mesh.userData = { row: r, col: c, isTile: true };
        this.group.add(mesh);
        this.tiles[r][c] = { mesh, occupied: null, baseColor: color };
      }
    }
  }

  // 左侧房区(僵尸生成点) 与 右侧工位(玩家基地) 装饰
  buildLandmarks() {
    const left = this.gridToWorld(0, -1).x;
    const right = this.gridToWorld(0, this.cols).x;

    // 左侧房区：暗红色长条
    const houseGeo = new THREE.BoxGeometry(this.cell, 0.3, this.rows * this.cell);
    const houseMat = new THREE.MeshLambertMaterial({ color: 0x8a3a3a });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(left, 0.05, 0);
    house.receiveShadow = true;
    this.group.add(house);

    // 右侧工位：蓝灰色长条 + 小电脑方块
    const baseGeo = new THREE.BoxGeometry(this.cell, 0.3, this.rows * this.cell);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6a });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(right, 0.05, 0);
    base.receiveShadow = true;
    this.group.add(base);

    for (let r = 0; r < this.rows; r++) {
      const z = this.gridToWorld(r, 0).z;
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x6a7a9a })
      );
      desk.position.set(right, 0.35, z);
      desk.castShadow = true;
      this.group.add(desk);
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
