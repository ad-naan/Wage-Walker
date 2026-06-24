import { PLANT_TYPES } from '../entities/Plant.js';
import { getCardIcon } from '../assets/icons.js';

/**
 * UI 管理器：资源条、血条、倒计时、卡片栏、牛头弹窗、道具系统UI。
 * 含怨气值条、工时券、天气遮罩、咖啡因中毒扭曲、白闪致盲等。
 */
export class UIManager {
  constructor(cardsConfig) {
    this.cardsConfig = cardsConfig;
    this.selectedCard = null;
    this.onCardClick = null;
    this.cardCooldowns = {};
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
      <div class="stat-block" id="level-title-block">
        <span class="stat-label" id="level-title">🌵 第X关 · 关卡名</span>
      </div>
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
        <span class="stat-label">🎫 工时券</span>
        <span class="stat-value" id="ticket-value" style="color:#c9a0ff">0</span>
      </div>
      <div class="stat-block" style="margin-left:auto">
        <span class="stat-label">第</span>
        <span class="stat-value" id="wave-display" style="color:#8effc1">0</span>
        <span class="stat-label" id="wave-total">/0</span>
        <span class="stat-label">波</span>
      </div>`;
    root.appendChild(top);

    // 怨气值条(右上方，大招充能)
    const rageBar = document.createElement('div');
    rageBar.id = 'rage-bar';
    rageBar.innerHTML = `<span class="rage-label">怒😡</span><div class="rage-bg"><div class="rage-fill" id="rage-fill"></div></div><span class="rage-text" id="rage-text">0/100</span>`;
    root.appendChild(rageBar);

    // 卡片栏
    const bar = document.createElement('div');
    bar.id = 'card-bar';
    this.cardEls = {};
    for (const c of this.cardsConfig) {
      const card = document.createElement('div');
      const cls = c.isSpecial ? 'card special-card' : c.isUlt ? 'card ult-card' : c.isTicket ? 'card ticket-card' : c.isSkill ? 'card skill-card' : 'card';
      card.className = cls;
      card.dataset.type = c.type;
      let costText;
      if (c.isUlt) costText = '怒' + c.rageCost;
      else if (c.isTicket) costText = '🎫' + c.ticketCost;
      else if (c.cost === 0) costText = '免费';
      else costText = '🐟' + c.cost;
      const svgIcon = getCardIcon(c.type);
      card.innerHTML = `
        <div class="card-icon">${svgIcon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-cost">${costText}</div>
        <div class="card-cd hidden"></div>`;
      // 植物卡片用拖拽，技能卡片用点击
      if (!c.isSkill && !c.isUlt && !c.isTicket) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => this._onCardDragStart(e, c.type));
      } else {
        card.addEventListener('click', () => this._handleCardClick(c.type));
      }
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
      <div class="niu-timer" id="niu-timer">⏳ 6秒内做选择，否则强制最坑项！</div>`;
    root.appendChild(modal);
    this.modal = modal;

    // 浮动提示
    const toast = document.createElement('div');
    toast.id = 'toast';
    root.appendChild(toast);
    this.toastEl = toast;

    // 光标提示
    const hint = document.createElement('div');
    hint.id = 'cursor-hint';
    hint.textContent = '🔨';
    root.appendChild(hint);
    this.cursorHint = hint;

    // 遮罩层
    const patrolFlash = document.createElement('div');
    patrolFlash.id = 'patrol-flash';
    root.appendChild(patrolFlash);
    this.patrolFlash = patrolFlash;

    const bossDarken = document.createElement('div');
    bossDarken.id = 'boss-darken';
    root.appendChild(bossDarken);
    this.bossDarken = bossDarken;

    const whiteFlash = document.createElement('div');
    whiteFlash.id = 'white-flash';
    root.appendChild(whiteFlash);
    this.whiteFlash = whiteFlash;

    const rainOverlay = document.createElement('div');
    rainOverlay.id = 'rain-overlay';
    root.appendChild(rainOverlay);
    this.rainOverlay = rainOverlay;

    const poisonOverlay = document.createElement('div');
    poisonOverlay.id = 'poison-overlay';
    root.appendChild(poisonOverlay);
    this.poisonOverlay = poisonOverlay;

    // 开始/结束画面
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.innerHTML = `
      <h1 id="overlay-title">植物大战僵尸：牛马版</h1>
      <p id="overlay-desc">坚守工位的打工人，种植牛马植物抵御僵尸，坚持15分钟到下班！</p>
      <button id="start-btn">开始搬砖</button>
      <div class="ctrl-hint">
        🌻 点击向日葵手动摸鱼(小心老板路过) | 📄 长按豌豆射手蓄力年终总结 | 🥜 坚果墙点击喊福报<br>
        🌻📄🥜植物卡片可拖拽到格子放置 | 公章 行政审批员减速射手(75🐟)<br>
        🔨 换鱼锤自动砸最前排僵尸(定身+伤害) | 🛡️ 甩锅盾牌击退3格 | 📷 团建合照致盲<br>
        ☕ 续命咖啡回血+攻速 | 📰 日报生成器产出×3 | ⚙️ 反向优化坚果墙满血<br>
        😎 终极摸鱼(怒气) | 📢 紧急会议(怒气)秒杀 | 💣 钉钉轰炸(怒气)全屏伤害<br>
        🌧️ 天气之子(工时券)暴雨减速 | 🗨️ 已读乱回(工时券)Boss专用<br>
        击杀僵尸积攒怨气值释放大招，概率掉落工时券
      </div>`;
    root.appendChild(overlay);
    this.overlay = overlay;
    this.overlayTitle = overlay.querySelector('#overlay-title');
    this.overlayDesc = overlay.querySelector('#overlay-desc');
    this.startBtn = overlay.querySelector('#start-btn');

    window.addEventListener('mousemove', (e) => {
      if (this._hammerMode) {
        this.cursorHint.style.left = e.clientX + 'px';
        this.cursorHint.style.top = e.clientY + 'px';
      }
    });
  }

  onStart(cb) { this.startBtn.addEventListener('click', () => { this.hideOverlay(); cb(); }); }
  _handleCardClick(type) { if (this.onCardClick) this.onCardClick(type); }

  /** 动态替换卡片栏(关卡切换时调用) */
  setCards(cardsConfig) {
    this.cardsConfig = cardsConfig;
    const bar = document.getElementById('card-bar');
    if (!bar) return;
    bar.innerHTML = '';
    this.cardEls = {};
    for (const c of this.cardsConfig) {
      const card = document.createElement('div');
      const cls = c.isSpecial ? 'card special-card' : c.isUlt ? 'card ult-card' : c.isTicket ? 'card ticket-card' : c.isSkill ? 'card skill-card' : 'card';
      card.className = cls;
      card.dataset.type = c.type;
      let costText;
      if (c.isUlt) costText = '怒' + c.rageCost;
      else if (c.isTicket) costText = '🎫' + c.ticketCost;
      else if (c.cost === 0) costText = '免费';
      else costText = '🐟' + c.cost;
      const svgIcon = getCardIcon(c.type);
      card.innerHTML = `
        <div class="card-icon">${svgIcon}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-cost">${costText}</div>
        <div class="card-cd hidden"></div>`;
      if (!c.isSkill && !c.isUlt && !c.isTicket) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => this._onCardDragStart(e, c.type));
      } else {
        card.addEventListener('click', () => this._handleCardClick(c.type));
      }
      bar.appendChild(card);
      this.cardEls[c.type] = card;
    }
  }

  /** 植物卡片拖拽开始：只显示图标作为拖拽图像 */
  _onCardDragStart(e, type) {
    this._dragType = type;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', type);
    // 创建只含图标的拖拽图像(不显示整个卡牌)
    const iconEl = this.cardEls[type].querySelector('.card-icon');
    if (iconEl) {
      e.dataTransfer.setDragImage(iconEl, 25, 25);
    }
  }

  selectCard(type) {
    this.selectedCard = type;
    for (const k in this.cardEls) this.cardEls[k].classList.toggle('selected', k === type);
  }
  clearSelection() { this.selectedCard = null; for (const k in this.cardEls) this.cardEls[k].classList.remove('selected'); }
  setCardCooldown(type, endTime) { this.cardCooldowns[type] = endTime; }
  setHammerMode(on) { this._hammerMode = on; document.body.classList.toggle('hammer-mode', on); this.cursorHint.style.display = on ? 'block' : 'none'; }

  flashRed() { this.patrolFlash.classList.remove('show'); void this.patrolFlash.offsetWidth; this.patrolFlash.classList.add('show'); }
  flashWhite() { this.whiteFlash.classList.remove('show'); void this.whiteFlash.offsetWidth; this.whiteFlash.classList.add('show'); }

  /** 老板出现紧急警告横幅 */
  showBossWarning(text) {
    let banner = document.getElementById('boss-warning');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'boss-warning';
      document.getElementById('ui-root').appendChild(banner);
    }
    banner.textContent = text;
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
    clearTimeout(this._bossWarnTimer);
    this._bossWarnTimer = setTimeout(() => banner.classList.remove('show'), 3000);
  }
  setBossDarken(on) { this.bossDarken.classList.toggle('show', on); }
  setShield(count) {
    const block = document.getElementById('shield-block');
    const val = document.getElementById('shield-value');
    if (count > 0) { block.style.display = 'flex'; val.textContent = count; }
    else block.style.display = 'none';
  }
  setWeather(on) { this.rainOverlay.classList.toggle('show', on); }
  setPoison(on) { this.poisonOverlay.classList.toggle('show', on); }
  setRage(value, max) {
    document.getElementById('rage-fill').style.width = Math.min(100, value / max * 100) + '%';
    document.getElementById('rage-text').textContent = Math.floor(value) + '/' + max;
  }
  setTickets(v) { document.getElementById('ticket-value').textContent = v; }

  /** 显示关卡标题(左上角) */
  showLevelInfo(level) {
    document.getElementById('level-title').textContent = `${level.icon} 第${level.id}关 · ${level.name}`;
    document.getElementById('wave-total').textContent = '/' + level.waves.length;
    document.getElementById('wave-display').textContent = '0';
  }

  /** 更新波次进度 N/M */
  updateWaveProgress(current, total) {
    document.getElementById('wave-display').textContent = current;
    document.getElementById('wave-total').textContent = '/' + total;
  }

  update(dt, now) {
    for (const type in this.cardEls) {
      const end = this.cardCooldowns[type] || 0;
      const cdEl = this.cardEls[type].querySelector('.card-cd');
      const remain = end - now;
      if (remain > 0) { cdEl.classList.remove('hidden'); cdEl.textContent = Math.ceil(remain) + 's'; this.cardEls[type].classList.add('disabled'); }
      else { cdEl.classList.add('hidden'); this.cardEls[type].classList.remove('disabled'); }
    }
    for (const c of this.cardsConfig) {
      if (c.isUlt || (c.isTicket && c.ticketCost === 0)) continue;
      const enough = c.isTicket ? this._tickets >= c.ticketCost : (c.cost === 0 || this._resourceAfford >= c.cost);
      if (!(this.cardCooldowns[c.type] > now)) this.cardEls[c.type].classList.toggle('disabled', !enough);
    }
    if (this.modal.classList.contains('show')) {
      const r = Math.max(0, this.niuDecisionEnd - now);
      document.getElementById('niu-timer').textContent = r > 0 ? `⏳ ${Math.ceil(r)}秒内做选择，否则强制最坑项！` : '⚠️ 时间到！强制执行最坑选项…';
    }
  }

  updateResource(v) { document.getElementById('resource-value').textContent = v; this._resourceAfford = v; }
  updateTickets(v) { this.setTickets(v); this._tickets = v; }
  updateBaseHp(ratio) { document.getElementById('base-hp-bar').style.width = Math.max(0, ratio * 100) + '%'; }
  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  showNiuEvent(event, onChoose, decisionEnd) {
    this.niuOnChoose = onChoose; this.niuDecisionEnd = decisionEnd;
    document.getElementById('niu-title').textContent = event.title;
    const opts = document.getElementById('niu-options'); opts.innerHTML = '';
    event.options.forEach((o, i) => {
      const el = document.createElement('div'); el.className = 'niu-option';
      el.textContent = `${String.fromCharCode(65 + i)}. ${o.text}`;
      el.addEventListener('click', () => { if (this.niuOnChoose) { const cb = this.niuOnChoose; this.niuOnChoose = null; cb(i); } });
      opts.appendChild(el);
    });
    this.modal.classList.add('show');
  }
  hideNiuEvent() { this.modal.classList.remove('show'); this.niuOnChoose = null; }
  isNiuActive() { return this.modal.classList.contains('show'); }

  showOverlay(result) {
    this.overlay.classList.remove('hidden');
    const title = this.overlayTitle; const desc = this.overlayDesc;
    title.className = '';
    if (result === 'win') { title.textContent = '🎉 准时下班成功！'; title.classList.add('win'); desc.innerHTML = '你成功摸鱼到下班！<br>点击下方按钮再来一局。'; }
    else if (result === 'lose') { title.textContent = '🪣 提桶跑路…'; title.classList.add('lose'); desc.innerHTML = '工位血量归零，僵尸攻陷了你的工位！<br>点击下方按钮再战。'; }
    else { title.textContent = '植物大战僵尸：牛马版'; desc.innerHTML = '坚守工位的打工人，种植牛马植物抵御僵尸，逐关挑战直至年终决战！'; }
    this.startBtn.textContent = result ? '再来一局' : '开始搬砖';
  }
  hideOverlay() { this.overlay.classList.add('hidden'); }

  /** 关卡结算弹窗(转发给 LevelUI) */
  showLevelResult(grade, level, maxUnlocked, failed = false, hpRatio = 0) {
    if (this._levelUI) this._levelUI.showResult(grade, level, maxUnlocked, failed, hpRatio);
  }
  /** 注入 LevelUI 引用 */
  setLevelUI(levelUI) { this._levelUI = levelUI; }
}
