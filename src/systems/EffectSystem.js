import * as THREE from 'three';

/**
 * 特效系统：浮动文字精灵 + 技能特效(回血/甩锅大会)。
 * 从 main.js 提取。所有特效挂载到 grid.group 以跟随棋盘偏移。
 */
export class EffectSystem {
  constructor() {
    this.floatTexts = [];
  }

  /** 生成浮动文字精灵 */
  spawnFloatText(group, pos, text, color = '#ffd34d') {
    const sprite = this._makeTextSprite(text, color);
    sprite.position.copy(pos);
    group.add(sprite);
    this.floatTexts.push({ sprite, life: 1.0, maxLife: 1.0, vy: 1.3 });
  }

  _makeTextSprite(text, color) {
    const cvs = document.createElement('canvas');
    cvs.width = 128; cvs.height = 64;
    const ctx = cvs.getContext('2d');
    ctx.font = 'bold 44px Microsoft YaHei, sans-serif';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 64, 32);
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.6, 0.8, 1);
    return sprite;
  }

  update(dt, group) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.life -= dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.material.opacity = Math.max(0, f.life / f.maxLife);
      if (f.life <= 0) {
        group.remove(f.sprite);
        f.sprite.material.map.dispose();
        f.sprite.material.dispose();
        this.floatTexts.splice(i, 1);
      }
    }
  }

  clear(group) {
    for (const ft of this.floatTexts) group.remove(ft.sprite);
    this.floatTexts = [];
  }

  /** 全场植物回血 ratio 比例 */
  healAllPlants(game, ratio) {
    for (const p of game.plants) {
      if (p.dead) continue;
      const heal = Math.round(p.maxHp * ratio);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const pos = p.mesh.position.clone(); pos.y += 1.2;
      this.spawnFloatText(game.grid.group, pos, '+' + heal, '#44dd44');
    }
  }

  /** 甩锅大会大招：聚拢僵尸到中间 + 眩晕4秒 */
  ultShuaigu(game) {
    if (game.zombies.length === 0) {
      game.ui.toast('场上没有僵尸可甩锅…');
      return false;
    }
    const centerX = 0;
    for (const z of game.zombies) {
      if (z.dead) continue;
      z.mesh.position.x = centerX + (Math.random() - 0.5) * 2;
      z.stunned = 4;
      z.doubleDamage = true;
    }
    game.ui.toast('🎪 甩锅大会！全场僵尸被强制开会，眩晕4秒');
    game.audio.play('die');
    game.particles.spawnUlt(game.grid.group);
    return true;
  }
}
