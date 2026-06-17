import * as THREE from 'three';

/**
 * 道具系统：实现优化方案中四大类道具的全部效果。
 * 包括攻击清场、陷阱防御、增益Buff、终极技能、工时券消耗品。
 * 含Debuff机制(甩锅闪腰/咖啡因中毒)。
 */
export class ItemSystem {
  constructor(game) {
    this.game = game;
    this.mines = [];        // 场上的地雷
    this.baits = [];        // 场上的大饼诱饵
    this.coffeeCount = 0;   // 续命咖啡使用次数(咖啡因中毒)
    this.coffeePoison = 0;  // 中毒剩余时间
    this.weatherTimer = 0;  // 天气持续剩余
    this.weatherType = null;// null/'rain'
    this.dabingMul = 1;     // 大饼吸引倍率
    this.reportMul = 1;     // 日报生成器倍率
    this.reportTimer = 0;   // 日报持续剩余
    this.ultMoyuTimer = 0;  // 终极摸鱼持续剩余
    this.plantStopTimer = 0;// 甩锅闪腰：植物停止攻击剩余
  }

  update(dt, game) {
    // 天气倒计时
    if (this.weatherTimer > 0) {
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) { this.weatherType = null; game.ui.setWeather(false); }
      else { // 暴雨减速60%
        for (const z of game.zombies) { if (!z.dead && z.stunned <= 0) z.speed = z.baseSpeed * 0.4; }
      }
    }
    // 日报倒计时
    if (this.reportTimer > 0) {
      this.reportTimer -= dt;
      if (this.reportTimer <= 0) this.reportMul = 1;
    }
    // 终极摸鱼倒计时
    if (this.ultMoyuTimer > 0) {
      this.ultMoyuTimer -= dt;
      if (this.ultMoyuTimer <= 0) game.ui.toast('终极摸鱼结束…该干活了');
    }
    // 甩锅闪腰
    if (this.plantStopTimer > 0) this.plantStopTimer -= dt;
    // 应急日报免疫策反倒计时
    if (this.emergencyReportTimer > 0) {
      this.emergencyReportTimer -= dt;
      if (this.emergencyReportTimer <= 0) game.ui.toast('应急日报免疫结束');
    }
    // 咖啡因中毒(屏幕扭曲由UI处理)
    if (this.coffeePoison > 0) {
      this.coffeePoison -= dt;
      game.ui.setPoison(this.coffeePoison > 0);
      if (this.coffeePoison <= 0) game.ui.setPoison(false);
    }
    // 地雷检测
    this._updateMines(dt, game);
    // 大饼诱饵
    this._updateBaits(dt, game);
  }

  /** 植物是否被闪腰停止攻击 */
  isPlantStopped() { return this.plantStopTimer > 0; }
  /** 终极摸鱼是否生效(道具免费) */
  isUltMoyu() { return this.ultMoyuTimer > 0; }

  // ========== 第一类：攻击/清场型 ==========

  /** 换鱼锤：自动投掷砸向最前排僵尸，定身3秒+伤害翻倍+额外伤害 */
  hammer(game) {
    // 找最前排(最靠近工位)的活僵尸
    const alive = game.zombies.filter((z) => !z.dead).sort((a, b) => b.mesh.position.x - a.mesh.position.x);
    if (alive.length === 0) { game.ui.toast('场上没有僵尸可砸！'); return false; }
    const target = alive[0];
    target.stunned = 3;
    target.doubleDamage = true;
    target.takeDamage(60); // 锤子额外伤害
    // 锤子飞行特效
    const p = target.mesh.position.clone(); p.y += 1.5;
    game.effects.spawnFloatText(game.grid.group, p, '🔨改PPT!', '#ff8800');
    game.particles.spawnDeath(game.grid.group, target.mesh.position.clone());
    game.ui.toast('🔨 换鱼锤砸中！僵尸定身3秒+受伤翻倍+60伤害');
    game.audio.play('plant');
    return true;
  }

  /** 甩锅盾牌：释放冲击波将所有僵尸击退3格(向左退回)，10%概率闪腰 */
  shield(game) {
    if (game.zombies.filter((z) => !z.dead).length === 0) { game.ui.toast('没有僵尸可甩锅'); return; }
    const knockback = game.cfg.CELL * 3; // 击退3格
    for (const z of game.zombies) {
      if (z.dead) continue;
      z.mesh.position.x -= knockback; // 向左击退(退回出发方向)
      // 确保不退出生成点
      const spawnX = game.grid.getSpawnX();
      if (z.mesh.position.x < spawnX) z.mesh.position.x = spawnX;
    }
    game.particles.spawnUlt(game.grid.group);
    game.ui.toast('🛡️ 甩锅成功！所有僵尸被击退3格');
    if (Math.random() < 0.1) {
      this.plantStopTimer = 1;
      game.ui.toast('💥 甩锅闪到腰！植物停止攻击1秒');
    }
  }

  /** 已读不回：投掷气泡，最近僵尸原地发呆5秒 */
  read(game) {
    const alive = game.zombies.filter((z) => !z.dead).sort((a, b) =>
      b.mesh.position.x - a.mesh.position.x); // 最前面的
    if (alive.length === 0) { game.ui.toast('没有僵尸可已读不回'); return; }
    alive[0].stunned = 5;
    const p = alive[0].mesh.position.clone(); p.y += 1.5;
    game.effects.spawnFloatText(game.grid.group, p, '已读', '#88ccff');
    game.ui.toast('气泡已读不回！僵尸发呆5秒');
  }

  /** 团建大合照：全屏致盲3秒+扣10%血量 */
  photo(game) {
    for (const z of game.zombies) {
      if (z.dead) continue;
      z.stunned = 3;
      z.hp -= z.maxHp * 0.1;
      if (z.hp <= 0) z.dead = true;
    }
    game.ui.flashWhite();
    game.particles.spawnUlt(game.grid.group);
    game.ui.toast('📷 团建大合照！全屏致盲3秒，扣10%血');
  }

  // ========== 第二类：战术陷阱/防御型 ==========

  /** 带薪拉屎地雷：埋地雷，僵尸踩中AOE爆炸+减速50% 4秒 */
  mine(game) {
    // 在随机行的僵尸前方放置
    const row = Math.floor(Math.random() * game.cfg.ROWS);
    const pos = game.grid.gridToWorld(row, Math.floor(game.cfg.COLS / 3));
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x8B4513, emissive: 0x442200, emissiveIntensity: 0.3 })
    );
    mesh.position.set(pos.x, 0.2, pos.z);
    game.grid.group.add(mesh);
    this.mines.push({ mesh, row, x: pos.x, exploded: false });
    game.ui.toast('💩 带薪拉屎地雷已埋设！');
  }

  _updateMines(dt, game) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      if (m.exploded) continue;
      // 检测是否有僵尸踩中
      for (const z of game.zombies) {
        if (z.dead || z.row !== m.row) continue;
        if (Math.abs(z.mesh.position.x - m.x) < 0.8) {
          m.exploded = true;
          game.grid.group.remove(m.mesh);
          m.mesh.geometry.dispose(); m.mesh.material.dispose();
          // AOE伤害
          for (const z2 of game.zombies) {
            if (z2.dead || z2.row !== m.row) continue;
            if (Math.abs(z2.mesh.position.x - m.x) < 2.5) {
              z2.takeDamage(80);
              z2.stunned = 0; // 不眩晕但减速
              z2._slowTimer = 4; // 自定义减速
            }
          }
          game.particles.spawnDeath(game.grid.group, m.mesh.position.clone());
          game.audio.play('die');
          game.ui.toast('💥 地雷爆炸！范围伤害+减速');
          this.mines.splice(i, 1);
          break;
        }
      }
    }
  }

  /** 调休单护盾：给最前排植物套500伤害护盾10秒 */
  tiaoxiu(game) {
    // 找最前排(最大col)的植物
    let target = null;
    for (const p of game.plants) {
      if (p.dead) continue;
      if (!target || p.col > target.col) target = p;
    }
    if (!target) { game.ui.toast('没有植物可套护盾'); return; }
    target.shieldHp = 500;
    target.shieldTimer = 10;
    target.invincible = 10;
    const pos = target.mesh.position.clone(); pos.y += 1.2;
    game.effects.spawnFloatText(game.grid.group, pos, '调休护盾', '#66ccff');
    game.ui.toast('📋 调休单护盾！最前排植物+500护盾10秒');
  }

  /** 大饼诱饵：放一张大饼，吸引周围僵尸走过去啃食 */
  dabing(game) {
    const row = Math.floor(Math.random() * game.cfg.ROWS);
    const pos = game.grid.gridToWorld(row, Math.floor(game.cfg.COLS / 2));
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xf5deb3, emissive: 0x886600, emissiveIntensity: 0.2 })
    );
    mesh.position.set(pos.x, 0.1, pos.z);
    game.grid.group.add(mesh);
    this.baits.push({ mesh, row, x: pos.x, hp: 5, life: 15 });
    game.ui.toast('🥞 大饼诱饵！僵尸都去吃饼了');
  }

  _updateBaits(dt, game) {
    for (let i = this.baits.length - 1; i >= 0; i--) {
      const b = this.baits[i];
      b.life -= dt;
      // 让同行僵尸朝大饼走
      for (const z of game.zombies) {
        if (z.dead || z.row !== b.row) continue;
        const dx = b.x - z.mesh.position.x;
        if (Math.abs(dx) < 1.0) {
          // 啃食大饼
          b.hp -= dt * 2;
        } else if (dx > 0) {
          // 向右走向大饼
          z.mesh.position.x += z.speed * dt;
        }
      }
      if (b.hp <= 0 || b.life <= 0) {
        game.grid.group.remove(b.mesh);
        b.mesh.geometry.dispose(); b.mesh.material.dispose();
        this.baits.splice(i, 1);
      }
    }
  }

  // ========== 第三类：增益/Buff类 ==========

  /** 续命咖啡：恢复工位30%血量+全体植物攻速+20% 8秒。超3次咖啡因中毒 */
  coffee(game) {
    game.healBase(Math.round(game.cfg.BASE_HP * 0.3));
    game.buffAttackSpeed(1.2, 8);
    this.coffeeCount++;
    const pos = new THREE.Vector3(0, 1, 0);
    game.effects.spawnFloatText(game.grid.group, pos, '+30%工位', '#44dd44');
    game.ui.toast('☕ 续命咖啡！工位回血30%+攻速提升8秒');
    // 超3次咖啡因中毒
    if (this.coffeeCount > 3) {
      this.coffeePoison = 8;
      game.ui.toast('⚠️ 咖啡因中毒！屏幕开始扭曲…');
      game.ui.setPoison(true);
    }
  }

  /** 日报自动生成器：向日葵15秒内产出翻三倍 */
  report(game) {
    this.reportMul = 3;
    this.reportTimer = 15;
    game.ui.toast('📰 日报自动生成器！向日葵产出×3持续15秒');
  }

  /** 反向优化：所有坚果墙血量回满+临时+50%最大血量 */
  optimize(game) {
    let count = 0;
    for (const p of game.plants) {
      if (p.dead || p.type !== 'wallnut') continue;
      const bonus = p.maxHp * 0.5;
      p.maxHp += bonus;
      p.hp = p.maxHp;
      count++;
    }
    game.ui.toast(count > 0 ? `⚙️ 反向优化！${count}个坚果墙满血+50%上限` : '没有坚果墙可优化');
  }

  // ========== 第四类：终极技能(消耗怨气值) ==========

  /** 终极摸鱼：10秒内所有道具免费+向日葵产出翻倍 */
  ultMoyu(game) {
    this.ultMoyuTimer = 10;
    game.ui.toast('😎 终极摸鱼！10秒内道具全免费+产出翻倍');
  }

  /** 紧急会议：全屏僵尸集合开会，5秒后非Boss暴毙 */
  ultMeeting(game) {
    if (game.zombies.length === 0) { game.ui.toast('没有僵尸可开会'); return false; }
    for (const z of game.zombies) {
      if (z.dead) continue;
      z.mesh.position.x = 0 + (Math.random() - 0.5) * 2;
      z.stunned = 5;
    }
    game.ui.toast('📢 紧急会议！5秒后非Boss僵尸被无聊死');
    // 5秒后执行
    setTimeout(() => {
      if (!game.running) return;
      for (const z of game.zombies) {
        if (z.dead || z.type === 'boss') continue;
        z.hp = 0;
        z.dead = true;
        game.particles.spawnDeath(game.grid.group, z.mesh.position.clone());
      }
      game.ui.toast('💀 会议结束！僵尸被无聊死了');
      game.audio.play('die');
    }, 5000);
    return true;
  }

  /** 钉钉轰炸：全屏落炸弹，巨额伤害+卡顿减速 */
  ultBomb(game) {
    if (game.zombies.length === 0) { game.ui.toast('没有僵尸可轰炸'); return false; }
    for (const z of game.zombies) {
      if (z.dead) continue;
      z.takeDamage(150);
      z.stunned = 3; // 卡顿效果
    }
    // 全屏炸弹粒子
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!game.running) return;
        const pos = new THREE.Vector3((Math.random() - 0.5) * 20, 0.5, (Math.random() - 0.5) * 16);
        game.particles.spawnDeath(game.grid.group, pos);
      }, i * 200);
    }
    game.ui.toast('💣 钉钉轰炸！全屏炸弹+卡顿减速');
    game.audio.play('die');
    return true;
  }

  // ========== 第五类：工时券消耗品 ==========

  /** 天气之子：暴雨，全屏僵尸(含Boss)减速60% 15秒 */
  weather(game) {
    this.weatherTimer = 15;
    this.weatherType = 'rain';
    game.ui.setWeather(true);
    game.ui.toast('🌧️ 天气之子！暴雨降临，僵尸减速60%');
  }

  /** 已读乱回：对Boss扣20%最大血量 */
  readback(game) {
    const bosses = game.zombies.filter((z) => !z.dead && z.type === 'boss');
    if (bosses.length === 0) { game.ui.toast('场上没有Boss可已读乱回'); return false; }
    for (const b of bosses) {
      const dmg = b.maxHp * 0.2;
      b.hp -= dmg;
      const p = b.mesh.position.clone(); p.y += 2;
      game.effects.spawnFloatText(game.grid.group, p, '-' + Math.round(dmg), '#ff3333');
    }
    game.ui.toast('🗨️ 已读乱回！Boss被语音转文字搞晕，扣20%血');
    return true;
  }

  // ========== 第六类：关卡特供道具 ==========

  /** 续命咖啡强化版(Lv4特供)：回血40%+攻速×1.5持续12秒，本局免疫咖啡因中毒 */
  coffee_boost(game) {
    game.healBase(Math.round(game.cfg.BASE_HP * 0.4));
    game.buffAttackSpeed(1.5, 12);
    this.coffeeCount = -999; // 标记本局免疫咖啡因中毒(永不超3次)
    const pos = new THREE.Vector3(0, 1, 0);
    game.effects.spawnFloatText(game.grid.group, pos, '+40%工位', '#44dd44');
    game.ui.toast('☕ 续命咖啡强化版！回血40%+攻速×1.5持续12秒，免疫中毒');
  }

  /** 应急日报系统(Lv5特供)：所有向日葵立即产出+100摸鱼值，免疫工贼策反15秒 */
  emergency_report(game) {
    let count = 0;
    for (const p of game.plants) {
      if (p.dead || p.type !== 'sunflower') continue;
      count++;
    }
    if (count > 0) {
      const gain = count * 100;
      game.resource.add(gain);
      const pos = new THREE.Vector3(0, 1, 0);
      game.effects.spawnFloatText(game.grid.group, pos, '+' + gain + '🐟', '#ffd34d');
    }
    this.emergencyReportTimer = 15; // 免疫策反时长
    game.ui.toast('🛡️ 应急日报系统！向日葵产出+100🐟并免疫策反15秒');
  }

  /** 年终奖炸弹(Lv6特供)：全屏僵尸扣当前血量50%+眩晕5秒 */
  year_bonus(game) {
    if (game.zombies.filter((z) => !z.dead).length === 0) {
      game.ui.toast('没有僵尸可炸');
      return;
    }
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dmg = z.hp * 0.5;
      z.hp -= dmg;
      z.stunned = 5;
      const p = z.mesh.position.clone(); p.y += 1.5;
      game.effects.spawnFloatText(game.grid.group, p, '-' + Math.round(dmg), '#ff3333');
    }
    game.particles.spawnUlt(game.grid.group);
    game.ui.flashWhite();
    game.ui.toast('🎆 年终奖炸弹！全屏僵尸扣50%血+眩晕5秒');
    game.audio.play('die');
  }

  /** 清理场上陷阱(新一局) */
  clear(game) {
    for (const m of this.mines) { game.grid.group.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose(); }
    for (const b of this.baits) { game.grid.group.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); }
    this.mines = []; this.baits = [];
    this.coffeeCount = 0; this.coffeePoison = 0;
    this.weatherTimer = 0; this.weatherType = null;
    this.reportMul = 1; this.reportTimer = 0;
    this.ultMoyuTimer = 0; this.plantStopTimer = 0;
    this.emergencyReportTimer = 0;
  }
}
