import { PLANT_TYPES } from '../entities/Plant.js';

/**
 * UI 管理器：用 HTML/CSS 叠加层绘制资源条、血条、倒计时、卡片栏、
 * 牛头事件弹窗、浮动提示与开始/结束画面。
 * 含屏幕变红(老板路过)/全屏变暗(Boss)/护盾显示等新机制。
 */
export class UIManager {
  constructor(cardsConfig) {
    this.cardsConfig = cardsConfig; // [{type, ...PLANT_TYPES}]
    this.selectedCard = null;
    this.onCardClick = null;        // 由 game 注入
    this.cardCooldowns = {};        // {type: endTime}
    this.niuOnChoose = null;
    this.niuDecisionEnd = 0;
    this.build();
  }

  build() {
    const root = document.getElementById('ui-root');

    // 顶部状态栏
    const top = document.createElement('div');
    top.id = 'top-bar';
    top.innerHTML = `
      <div class="stat-block">
        <span class="stat-label">🐟 摸鱼值</span>
        <span class="stat-value" id="resource-value">50</span>
      </div>
      <div class="stat-block">
        <span class="stat-label">🏠 工位血量</span>
        <div id="base-hp-bar-bg"><div id="base-hp-bar"></div></div>
      </div>
      <div class="stat-block" id="shield-block" style="display:none">
        <span class="stat-label">🛡️ 护盾</span>
        <span class="stat-value" id="shield-value" style="color:#66ccff">0</span>
      </div>
      <div class="stat-block">
        <span class="stat-label">⏰ 下班倒计时</span>
        <span id="timer-display">5:00</span>
      </div>
      <div class="stat-block" style="margin-left:auto">
        <span class="stat-label">第</span>
        <span class="stat-value" id="wave-display" style="color:#8effc1">0</span>
        <span class="stat-label">波</span>
      </div>`;
    root.appendChild(top);

    // 卡片栏
    const bar = document.createElement('div');
    bar.id = 'card-bar';
    this.cardEls = {};
    for (const c of this.cardsConfig) {
      const card = document.createElement('div');
      card.className = 'card' + (c.isSkill ? ' skill-card' : '');
      card.dataset.type = c.type;
      card.innerHTML = `
        <div class="card-icon">${c.icon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-cost">${c.isSkill ? (c.cost > 0 ? '🐟' + c.cost : '技能') : '🐟' + c.cost}</div>
        <div class="card-cd hidden"></div>`;
      card.addEventListener('click', () => this._handleCardClick(c.type));
      bar.appendChild(card);
      this.cardEls[c.type] = card;
    }
    root.appendChild(bar);

    // 牛头事件弹窗
    const modal = document.createElement('div');
    modal.id = 'niu-modal';
    modal.innerHTML = `
      <div class="niu-head">🐮</div>
      <div class="niu-title" id="niu-title">牛头指导来袭！</div>
      <div class="niu-options" id="niu-options"></div>
      <div class="niu-timer" id="niu-timer">⏳ 8秒内做选择，否则强制最坑项！</div>`;
    root.appendChild(modal);
    this.modal = modal;

    // 浮动提示
    const toast = document.createElement('div');
    toast.id = 'toast';
    root.appendChild(toast);
    this.toastEl = toast;

    // 光标提示(锤子模式)
    const hint = document.createElement('div');
    hint.id = 'cursor-hint';
    hint.textContent = '🔨';
    root.appendChild(hint);
    this.cursorHint = hint;

    // 老板路过屏幕变红遮罩
    const patrolFlash = document.createElement('div');
    patrolFlash.id = 'patrol-flash';
    root.appendChild(patrolFlash);
    this.patrolFlash = patrolFlash;

    // Boss全屏变暗遮罩
    const bossDarken = document.createElement('div');
    bossDarken.id = 'boss-darken';
    root.appendChild(bossDarken);
    this.bossDarken = bossDarken;

    // 下班高峰提示条
    const rushBanner = document.createElement('div');
    rushBanner.id = 'rush-banner';
    rushBanner.textContent = '🔥 下班高峰！僵尸暴增，摸鱼值翻倍！坚持住！';
    rushBanner.style.display = 'none';
    root.appendChild(rushBanner);
    this.rushBanner = rushBanner;

    // 开始/结束画面
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.innerHTML = `
      <h1 id="overlay-title">植物大战僵尸：牛马版</h1>
      <p id="overlay-desc">你是一个坚守工位的打工人。种植"牛马植物"抵御甲方/老板/KPI僵尸的进攻，坚持5分钟到下班！<br>
        🖱️ 点击向日葵可手动摸鱼(小心老板路过！)、长按豌豆射手蓄力发射年终总结、点击坚果墙喊福报无敌。<br>
        🛡️ 工位护盾抵挡攻击、💊 全员回血、🎪 甩锅大会聚拢僵尸眩晕清场。小心"牛头指导"随机干扰！</p>
      <button id="start-btn">开始搬砖</button>
      <div class="ctrl-hint">
        🖱️ 点击底部卡片选中植物/技能 → 点击草地放置/点击僵尸使用<br>
        🌻 点击向日葵手动产出摸鱼值(15%概率触发老板路过，2秒内别再点)<br>
        📄 长按PPT豌豆射手蓄力→发射年终总结大炮弹(消耗额外50摸鱼值)<br>
        🥜 996坚果墙每分钟持续消耗10摸鱼值，不足会枯萎；点击喊"福报！"无敌1秒<br>
        🔨 摸鱼锤：点牛头幽灵打断干扰 / 点僵尸定身3秒+伤害翻倍<br>
        🛡️ 护盾(100🐟)抵挡5次攻击 | 💊 回血(50🐟)全场植物+20% | 🎪 甩锅大会(免费/60s冷却)聚拢僵尸眩晕4秒<br>
        👑 Boss出现全屏变暗，每步有10%概率开除一颗植物(优先向日葵)；击杀掉落200🐟<br>
        💰 摸鱼值为负或工位血量归零即"提桶跑路"
      </div>`;
    root.appendChild(overlay);
    this.overlay = overlay;
    this.overlayTitle = overlay.querySelector('#overlay-title');
    this.overlayDesc = overlay.querySelector('#overlay-desc');
    this.startBtn = overlay.querySelector('#start-btn');

    // 鼠标移动跟随锤子提示
    window.addEventListener('mousemove', (e) => {
      if (this._hammerMode) {
        this.cursorHint.style.left = e.clientX + 'px';
        this.cursorHint.style.top = e.clientY + 'px';
      }
    });
  }

  onStart(cb) {
    this.startBtn.addEventListener('click', () => {
      this.hideOverlay();
      cb();
    });
  }

  _handleCardClick(type) {
    if (this.onCardClick) this.onCardClick(type);
  }

  selectCard(type) {
    this.selectedCard = type;
    for (const k in this.cardEls) {
      this.cardEls[k].classList.toggle('selected', k === type);
    }
  }

  clearSelection() {
    this.selectedCard = null;
    for (const k in this.cardEls) this.cardEls[k].classList.remove('selected');
  }

  setCardCooldown(type, endTime) {
    this.cardCooldowns[type] = endTime;
  }

  setHammerMode(on) {
    this._hammerMode = on;
    document.body.classList.toggle('hammer-mode', on);
    this.cursorHint.style.display = on ? 'block' : 'none';
  }

  /** 屏幕变红闪烁(老板路过警告) */
  flashRed() {
    this.patrolFlash.classList.remove('show');
    // 强制重绘以重新触发动画
    void this.patrolFlash.offsetWidth;
    this.patrolFlash.classList.add('show');
  }

  /** Boss全屏变暗 */
  setBossDarken(on) {
    this.bossDarken.classList.toggle('show', on);
  }

  /** 护盾显示 */
  setShield(count) {
    const block = document.getElementById('shield-block');
    const val = document.getElementById('shield-value');
    if (count > 0) {
      block.style.display = 'flex';
      val.textContent = count;
    } else {
      block.style.display = 'none';
    }
  }

  /** 下班高峰提示 */
  setRushMode(on) {
    this.rushBanner.style.display = on ? 'block' : 'none';
    document.getElementById('timer-display').classList.toggle('rush', on);
  }

  update(dt, now) {
    // 卡片冷却显示
    for (const type in this.cardEls) {
      const end = this.cardCooldowns[type] || 0;
      const cdEl = this.cardEls[type].querySelector('.card-cd');
      const remain = end - now;
      if (remain > 0) {
        cdEl.classList.remove('hidden');
        cdEl.textContent = Math.ceil(remain) + 's';
        this.cardEls[type].classList.add('disabled');
      } else {
        cdEl.classList.add('hidden');
        this.cardEls[type].classList.remove('disabled');
      }
    }
    // 卡片可用性(摸鱼值不足灰显，免费技能除外)
    for (const c of this.cardsConfig) {
      if (c.isSkill && c.cost === 0) continue;
      const enough = this._resourceAfford >= c.cost;
      if (!(this.cardCooldowns[c.type] > now)) {
        this.cardEls[c.type].classList.toggle('disabled', !enough);
      }
    }
    // 牛头事件倒计时
    if (this.modal.classList.contains('show')) {
      const r = Math.max(0, this.niuDecisionEnd - now);
      document.getElementById('niu-timer').textContent =
        r > 0 ? `⏳ ${Math.ceil(r)}秒内做选择，否则强制最坑项！` : '⚠️ 时间到！强制执行最坑选项…';
    }
  }

  updateResource(v) {
    document.getElementById('resource-value').textContent = v;
    this._resourceAfford = v;
  }

  updateBaseHp(ratio) {
    document.getElementById('base-hp-bar').style.width = Math.max(0, ratio * 100) + '%';
  }

  updateTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const el = document.getElementById('timer-display');
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    // 下班高峰检测(最后45秒)
    this.setRushMode(sec <= 45 && sec > 0);
  }

  updateWave(w) {
    document.getElementById('wave-display').textContent = w;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  showNiuEvent(event, onChoose, decisionEnd) {
    this.niuOnChoose = onChoose;
    this.niuDecisionEnd = decisionEnd;
    document.getElementById('niu-title').textContent = event.title;
    const opts = document.getElementById('niu-options');
    opts.innerHTML = '';
    event.options.forEach((o, i) => {
      const el = document.createElement('div');
      el.className = 'niu-option';
      el.textContent = `${String.fromCharCode(65 + i)}. ${o.text}`;
      el.addEventListener('click', () => {
        if (this.niuOnChoose) {
          const cb = this.niuOnChoose;
          this.niuOnChoose = null;
          cb(i);
        }
      });
      opts.appendChild(el);
    });
    this.modal.classList.add('show');
  }

  hideNiuEvent() {
    this.modal.classList.remove('show');
    this.niuOnChoose = null;
  }

  isNiuActive() {
    return this.modal.classList.contains('show');
  }

  showOverlay(result) {
    this.overlay.classList.remove('hidden');
    const title = this.overlayTitle;
    const desc = this.overlayDesc;
    title.className = '';
    if (result === 'win') {
      title.textContent = '🎉 准时下班成功！';
      title.classList.add('win');
      desc.innerHTML = '你成功摸鱼到下班！工位保住了，今天又是没有猝死的一天。<br>实际上明天还要来…点击下方按钮再来一局。';
    } else if (result === 'lose') {
      title.textContent = '🪣 提桶跑路…';
      title.classList.add('lose');
      desc.innerHTML = '工位失守 / 摸鱼值透支，你只能提桶跑路了。<br>点击下方按钮重整旗鼓再战。';
    } else {
      title.textContent = '植物大战僵尸：牛马版';
      desc.innerHTML = '你是一个坚守工位的打工人。种植"牛马植物"抵御甲方/老板/KPI僵尸的进攻，坚持5分钟到下班！<br>\n        🖱️ 点击向日葵可手动摸鱼(小心老板路过！)、长按豌豆射手蓄力发射年终总结、点击坚果墙喊福报无敌。<br>\n        🛡️ 工位护盾抵挡攻击、💊 全员回血、🎪 甩锅大会聚拢僵尸眩晕清场。小心"牛头指导"随机干扰！';
    }
    this.startBtn.textContent = result ? '再来一局' : '开始搬砖';
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }
}
