import { PLANT_TYPES } from '../entities/Plant.js';

/**
 * UI 管理器：用 HTML/CSS 叠加层绘制资源条、血条、倒计时、卡片栏、
 * 牛头事件弹窗、浮动提示与开始/结束画面。
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
      card.className = 'card';
      card.dataset.type = c.type;
      card.innerHTML = `
        <div class="card-icon">${c.icon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-cost">${c.isSkill ? '技能' : '🐟' + c.cost}</div>
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

    // 开始/结束画面
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.innerHTML = `
      <h1 id="overlay-title">植物大战僵尸：牛马版</h1>
      <p id="overlay-desc">你是一个坚守工位的打工人。种植"牛马植物"抵御甲方/老板/KPI僵尸的进攻，坚持5分钟到下班！<br>
        小心"牛头指导"随机干扰，手快可用摸鱼锤敲碎牛头幽灵打断。</p>
      <button id="start-btn">开始搬砖</button>
      <div class="ctrl-hint">
        🖱️ 点击底部卡片选中植物 → 点击草地放置<br>
        🔨 选中摸鱼锤后点击场上的"牛头幽灵"可打断干扰(20%概率反向加班)<br>
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
    // 卡片可用性(摸鱼值不足灰显，技能除外)
    for (const c of this.cardsConfig) {
      if (c.isSkill) continue;
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
    document.getElementById('timer-display').textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }

  updateWave(w) {
    document.getElementById('wave-display').textContent = w;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2000);
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
      title.textContent = '🎉 带薪拉屎成功！';
      title.classList.add('win');
      desc.innerHTML = '你成功摸鱼到下班！工位保住了，今天又是没有猝死的一天。<br>点击下方按钮再来一局。';
    } else if (result === 'lose') {
      title.textContent = '🪣 提桶跑路…';
      title.classList.add('lose');
      desc.innerHTML = '工位失守 / 摸鱼值透支，你只能提桶跑路了。<br>点击下方按钮重整旗鼓再战。';
    } else {
      title.textContent = '植物大战僵尸：牛马版';
      desc.innerHTML = '你是一个坚守工位的打工人。种植"牛马植物"抵御甲方/老板/KPI僵尸的进攻，坚持5分钟到下班！<br>小心"牛头指导"随机干扰，手快可用摸鱼锤敲碎牛头幽灵打断。';
    }
    this.startBtn.textContent = result ? '再来一局' : '开始搬砖';
  }

  hideOverlay() {
    this.overlay.classList.add('hidden');
  }
}
