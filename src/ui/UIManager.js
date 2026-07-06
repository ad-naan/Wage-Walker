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
        <span class="stat-label" id="level-title">第X关 · 关卡名</span>
      </div>
      <div class="stat-block">
        <span class="stat-label">摸鱼值</span>
        <span class="stat-value" id="resource-value">50</span>
      </div>
      <div class="stat-block">
        <span class="stat-label">工位血量</span>
        <div id="base-hp-bar-bg"><div id="base-hp-bar"></div></div>
      </div>
      <div class="stat-block" id="shield-block" style="display:none">
        <span class="stat-label">护盾</span>
        <span class="stat-value" id="shield-value" style="color:#66ccff">0</span>
      </div>
      <div class="stat-block">
        <span class="stat-label">工时券</span>
        <span class="stat-value" id="ticket-value" style="color:#c9a0ff">0</span>
      </div>
      <div class="stat-block" style="margin-left:auto">
        <span class="stat-label">第</span>
        <span class="stat-value" id="wave-display" style="color:#8effc1">0</span>
        <span class="stat-label" id="wave-total">/0</span>
        <span class="stat-label">波</span>
      </div>
      <div class="stat-block" id="enemy-count-block">
        <span class="stat-label">来袭</span>
        <span class="stat-value" id="enemy-count" style="color:#ff8a80">0</span>
      </div>
      <div class="stat-block" id="score-block">
        <span class="stat-label">得分</span>
        <span class="stat-value" id="score-value" style="color:#66ccff">0</span>
      </div>`;
    root.appendChild(top);

    // 怨气值条(右上方，大招充能)
    const rageBar = document.createElement('div');
    rageBar.id = 'rage-bar';
    rageBar.innerHTML = `<span class="rage-label">怒</span><div class="rage-bg"><div class="rage-fill" id="rage-fill"></div></div><span class="rage-text" id="rage-text">0/100</span>`;
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
      else if (c.isTicket) costText = '\u{1F3AB}' + c.ticketCost;
      else if (c.cost === 0) costText = '免费';
      else costText = '\u{1F41F}' + c.cost;
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
      <div class="niu-head">牛</div>
      <div class="niu-title" id="niu-title">牛头指导来袭！</div>
      <div class="niu-options" id="niu-options"></div>
      <div class="niu-timer" id="niu-timer">⏳ 6秒内做选择，否则强制最坑项！</div>`;
    root.appendChild(modal);
    this.modal = modal;

    // 波次来临横幅
    const waveBanner = document.createElement('div');
    waveBanner.id = 'wave-banner';
    root.appendChild(waveBanner);
    this.waveBanner = waveBanner;

    // 暂停遮罩
    const pauseOverlay = document.createElement('div');
    pauseOverlay.id = 'pause-overlay';
    pauseOverlay.innerHTML = '<div class="pause-text">⏸ 已暂停</div><div class="pause-hint">按 [空格] 或点击暂停按钮继续<br>[1] [2] [3] 切换游戏速度</div>';
    root.appendChild(pauseOverlay);
    this.pauseOverlay = pauseOverlay;

    // 教程提示框
    const tutorialTip = document.createElement('div');
    tutorialTip.id = 'tutorial-tip';
    root.appendChild(tutorialTip);
    this.tutorialTip = tutorialTip;
    this._tipTimer = null;

    // 浮动提示
    const toast = document.createElement('div');
    toast.id = 'toast';
    root.appendChild(toast);
    this.toastEl = toast;

    // 光标提示
    const hint = document.createElement('div');
    hint.id = 'cursor-hint';
    hint.textContent = '锤';
    hint.style.fontWeight = 'bold';
    hint.style.fontSize = '24px';
    hint.style.color = '#ffd34d';
    hint.style.textShadow = '0 0 8px rgba(255,211,77,.5)';
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
      <p id="overlay-desc">坚守工位的打工人，种植牛马植物抵御僵尸，逐关挑战直至年终决战！</p>
      <button id="start-btn">开始搬砖</button>
      <div class="ctrl-hint" style="font-size:11px; color:rgba(255,255,255,.4); margin-top:16px; line-height:1.8; text-align:center; max-width:640px;">
        拖拽卡片放置植物 | 点击向日葵社畜收摸鱼值<br>
        摸鱼值(🐟)种植物 | 怒气值释放大招 | 工时券(🎫)用消耗品<br>
        [空格] 暂停 | [1][2][3] 切换游戏速度 | 右键拖拽旋转视角<br>
        击杀僵尸积攒怨气值释放大招，概率掉落工时券
      </div>
    `;
    root.appendChild(overlay);
    this.overlay = overlay;
    this.overlayTitle = overlay.querySelector('#overlay-title');
    this.overlayDesc = overlay.querySelector('#overlay-desc');
    this.startBtn = overlay.querySelector('#start-btn');

    // 帮助按钮
    const helpBtn = document.createElement('div');
    helpBtn.id = 'help-btn';
    helpBtn.textContent = '?';
    helpBtn.title = '游戏帮助';
    helpBtn.addEventListener('click', () => this._toggleHelp());
    root.appendChild(helpBtn);

    // 帮助弹窗
    const helpOverlay = document.createElement('div');
    helpOverlay.id = 'help-overlay';
    helpOverlay.className = 'hidden';
    helpOverlay.innerHTML = `
      <div class="help-box">
        <div class="help-title">游戏说明</div>
        <div class="help-section">
          <h3>基本玩法</h3>
          <p>僵尸从左侧来袭，目标是保护右侧工位不被攻破。</p>
          <ul>
            <li><b>向日葵社畜</b>：生产摸鱼值，点击额外加成（小心老板巡逻）</li>
            <li><b>PPT射手</b>：核心输出，发射文档弹丸攻击僵尸</li>
            <li><b>996坚果墙</b>：肉盾，高血量阻挡僵尸前进</li>
            <li><b>行政审批员</b>：远程攻击+减速效果</li>
          </ul>
        </div>
        <div class="help-section">
          <h3>资源系统</h3>
          <p><b>摸鱼值</b>：种植和技能消耗，向日葵生产+被动产出</p>
          <p><b>怨气值</b>：击杀僵尸积累，满100释放大招</p>
          <p><b>工时券</b>：击杀概率掉落，用于特殊消耗品</p>
        </div>
        <div class="help-section">
          <h3>操作快捷键</h3>
          <ul>
            <li>点击/拖拽底部卡片选择植物，再点草地放置</li>
            <li><b>[空格]</b> 暂停/继续游戏</li>
            <li><b>[1][2][3]</b> 切换游戏速度 1x/2x/3x</li>
            <li><b>[C]</b> 切换预设视角</li>
            <li><b>右键拖拽</b> 自由旋转视角，滚轮缩放</li>
            <li>PPT射手<b>长按</b>蓄力可发射年终总结大招（消耗摸鱼值）</li>
            <li>点击向日葵社畜产额外摸鱼值（有风险！）</li>
          </ul>
        </div>
        <div class="help-section">
          <h3>特殊事件</h3>
          <p><b>牛头指导</b>：定期弹出，选择不同效果。可用摸鱼锤敲碎幽灵打断！</p>
          <p><b>老板巡逻</b>：点向日葵时随机触发，扣摸鱼值</p>
        </div>
        <button class="help-close" id="help-close-btn">明白了！</button>
      </div>`;
    root.appendChild(helpOverlay);
    helpOverlay.querySelector('#help-close-btn').addEventListener('click', () => this._toggleHelp());
    helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) this._toggleHelp(); });
    this.helpOverlay = helpOverlay;

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

    // 按类型分组: 植物 → 技能 → 大招 → 工时券 → 特殊
    const groups = [
      { types: ['sunflower','peashooter','wallnut','auditor'], label: '' },
      { filter: (c) => c.isSkill && !c.isSpecial, label: 'sep' },
      { filter: (c) => c.isUlt, label: 'sep-ult' },
      { filter: (c) => c.isTicket, label: 'sep-ticket' },
      { filter: (c) => c.isSpecial, label: 'sep-special' },
    ];

    const placed = new Set();
    for (const cfg of this.cardsConfig) {
      if (placed.has(cfg.type)) continue;
      placed.add(cfg.type);
      const c = cfg;

      // 在技能组前加分隔线
      const prevCard = this.cardsConfig[this.cardsConfig.indexOf(c) - 1];
      if (prevCard && !prevCard.isSkill && c.isSkill) {
        const sep = document.createElement('div');
        sep.className = 'card-sep';
        bar.appendChild(sep);
      }

      const card = document.createElement('div');
      const cls = c.isSpecial ? 'card special-card' : c.isUlt ? 'card ult-card' : c.isTicket ? 'card ticket-card' : c.isSkill ? 'card skill-card' : 'card';
      card.className = cls;
      card.dataset.type = c.type;
      let costText;
      if (c.isUlt) costText = '怒' + c.rageCost;
      else if (c.isTicket) costText = '\u{1F3AB}' + c.ticketCost;
      else if (c.cost === 0) costText = '免费';
      else costText = '\u{1F41F}' + c.cost;
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

  /** 显示波次来临横幅 */
  showWaveBanner(waveNum, totalWaves, text) {
    this.waveBanner.innerHTML = `第 ${waveNum}/${totalWaves} 波<span class="wave-sub">${text}</span>`;
    this.waveBanner.classList.add('show');
    clearTimeout(this._waveBannerTimer);
    this._waveBannerTimer = setTimeout(() => this.waveBanner.classList.remove('show'), 2200);
  }

  /** 显示暂停遮罩 */
  setPaused(on) {
    this.pauseOverlay.classList.toggle('show', on);
  }

  /** 显示教程提示 */
  showTip(text) {
    clearTimeout(this._tipTimer);
    this.tutorialTip.innerHTML = '<span class="tip-icon">💡</span>' + text;
    this.tutorialTip.classList.add('show');
    this._tipTimer = setTimeout(() => this.tutorialTip.classList.remove('show'), 5000);
  }

  hideTip() {
    clearTimeout(this._tipTimer);
    this.tutorialTip.classList.remove('show');
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
      const el = this.cardEls[c.type];
      if (!el) continue;
      const enough = c.isTicket ? this._tickets >= c.ticketCost : (c.cost === 0 || this._resourceAfford >= c.cost);
      if (!(this.cardCooldowns[c.type] > now)) el.classList.toggle('disabled', !enough);
    }
    if (this.modal.classList.contains('show')) {
      const r = Math.max(0, this.niuDecisionEnd - now);
      document.getElementById('niu-timer').textContent = r > 0 ? `⏳ ${Math.ceil(r)}秒内做选择，否则强制最坑项！` : '⚠️ 时间到！强制执行最坑选项…';
    }
  }

  updateResource(v) { document.getElementById('resource-value').textContent = v; this._resourceAfford = v; }
  updateTickets(v) { this.setTickets(v); this._tickets = v; }
  updateBaseHp(ratio) { document.getElementById('base-hp-bar').style.width = Math.max(0, ratio * 100) + '%'; }
  updateEnemyCount(v) { const el = document.getElementById('enemy-count'); if (el) el.textContent = v; }
  updateScore(v) { const el = document.getElementById('score-value'); if (el) el.textContent = v; }
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

  _toggleHelp() { this.helpOverlay.classList.toggle('hidden'); }

  /** 关卡结算弹窗(转发给 LevelUI) */
  showLevelResult(grade, level, maxUnlocked, failed = false, hpRatio = 0) {
    if (this._levelUI) this._levelUI.showResult(grade, level, maxUnlocked, failed, hpRatio);
  }
  /** 注入 LevelUI 引用 */
  setLevelUI(levelUI) { this._levelUI = levelUI; }
}
