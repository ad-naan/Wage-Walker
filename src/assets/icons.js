/**
 * SVG 图标生成器
 * 为所有植物和道具生成低多边形风格的 SVG 图标
 * 匹配 3D 模型的颜色和风格
 */

export function getCardIcon(type) {
  const icons = {
    // ===== 植物 =====
    sunflower: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 茎 -->
      <rect x="23" y="28" width="2" height="12" fill="#2e8b3e" rx="1"/>
      <!-- 花瓣 -->
      <circle cx="24" cy="14" r="3.5" fill="#ffb300"/>
      <circle cx="30" cy="18" r="3.5" fill="#ffb300"/>
      <circle cx="30" cy="24" r="3.5" fill="#ffb300"/>
      <circle cx="24" cy="28" r="3.5" fill="#ffb300"/>
      <circle cx="18" cy="24" r="3.5" fill="#ffb300"/>
      <circle cx="18" cy="18" r="3.5" fill="#ffb300"/>
      <!-- 花心 -->
      <circle cx="24" cy="21" r="7" fill="#ffd34d"/>
      <!-- 表情 -->
      <circle cx="21" cy="20" r="1" fill="#333"/>
      <circle cx="27" cy="20" r="1" fill="#333"/>
      <path d="M21 24 Q24 26 27 24" stroke="#333" stroke-width="1" fill="none"/>
    </svg>`,

    peashooter: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 身体(西装) -->
      <rect x="18" y="22" width="12" height="14" rx="3" fill="#2a4a8a"/>
      <!-- 领带 -->
      <rect x="23" y="24" width="2" height="8" fill="#c0392b"/>
      <!-- 头 -->
      <circle cx="24" cy="18" r="8" fill="#ffd2b8"/>
      <!-- 眼镜 -->
      <rect x="16" y="15" width="6" height="4" rx="2" fill="none" stroke="#111" stroke-width="1.5"/>
      <rect x="26" y="15" width="6" height="4" rx="2" fill="none" stroke="#111" stroke-width="1.5"/>
      <line x1="22" y1="17" x2="26" y2="17" stroke="#111" stroke-width="1.5"/>
      <!-- 激光笔枪管 -->
      <rect x="31" y="20" width="10" height="3" rx="1" fill="#1a3060"/>
      <!-- 眼睛 -->
      <circle cx="19" cy="17" r="1.5" fill="#111"/>
      <circle cx="29" cy="17" r="1.5" fill="#111"/>
    </svg>`,

    wallnut: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 坚果壳 -->
      <ellipse cx="24" cy="24" rx="12" ry="14" fill="#b8863a"/>
      <!-- 顶部帽盖 -->
      <path d="M12 20 Q24 8 36 20" fill="#5a3a18"/>
      <!-- 茎 -->
      <rect x="23" y="4" width="2" height="6" fill="#3a5a1a" rx="1"/>
      <!-- 黑眼圈 -->
      <ellipse cx="18" cy="22" rx="3" ry="2.5" fill="#6b3a3a"/>
      <ellipse cx="30" cy="22" rx="3" ry="2.5" fill="#6b3a3a"/>
      <!-- 眼睛 -->
      <circle cx="18" cy="22" r="1.2" fill="#111"/>
      <circle cx="30" cy="22" r="1.2" fill="#111"/>
      <!-- 嘴巴 -->
      <rect x="20" y="28" width="8" height="2" rx="1" fill="#222"/>
      <!-- 牙齿 -->
      <rect x="21" y="27" width="6" height="1.5" fill="#fff" rx="0.5"/>
    </svg>`,

    auditor: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 身体(行政夹克) -->
      <rect x="16" y="26" width="16" height="14" rx="2" fill="#1a3a5a"/>
      <!-- 头 -->
      <circle cx="24" cy="20" r="8" fill="#ffd2b8"/>
      <!-- 头发(三七分) -->
      <path d="M16 18 Q24 6 32 18" fill="#1a1a1a"/>
      <!-- 方框眼镜 -->
      <rect x="16" y="17" width="7" height="5" rx="1" fill="none" stroke="#111" stroke-width="1.2"/>
      <rect x="25" y="17" width="7" height="5" rx="1" fill="none" stroke="#111" stroke-width="1.2"/>
      <line x1="23" y1="19.5" x2="25" y2="19.5" stroke="#111" stroke-width="1.2"/>
      <!-- 严肃嘴 -->
      <line x1="20" y1="24" x2="28" y2="24" stroke="#222" stroke-width="1.5"/>
      <!-- 公章(举起) -->
      <rect x="34" y="16" width="6" height="10" rx="1" fill="#c0392b"/>
      <circle cx="37" cy="19" r="2" fill="#d4a017"/>
      <!-- 工牌 -->
      <rect x="26" y="28" width="4" height="3" fill="#fff" rx="0.5"/>
    </svg>`,

    // ===== 第一类：攻击/清场型 =====
    hammer: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 锤柄 -->
      <rect x="22" y="20" width="4" height="20" fill="#8B4513" rx="1"/>
      <!-- 锤头 -->
      <rect x="12" y="10" width="24" height="12" rx="3" fill="#666"/>
      <!-- 锤面 -->
      <rect x="10" y="12" width="4" height="8" rx="1" fill="#888"/>
      <!-- 反光 -->
      <rect x="16" y="12" width="10" height="2" fill="#aaa" rx="1"/>
    </svg>`,

    shield: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 盾牌形状 -->
      <path d="M24 6 L38 14 L38 28 Q38 38 24 42 Q10 38 10 28 L10 14 Z" fill="#4a6fa5"/>
      <!-- 边框 -->
      <path d="M24 6 L38 14 L38 28 Q38 38 24 42 Q10 38 10 28 L10 14 Z" fill="none" stroke="#ffd34d" stroke-width="2"/>
      <!-- 锅图案 -->
      <ellipse cx="24" cy="24" rx="8" ry="6" fill="#8B4513"/>
      <ellipse cx="24" cy="22" rx="7" ry="5" fill="#A0522D"/>
      <path d="M16 20 Q24 16 32 20" stroke="#fff" stroke-width="1" fill="none"/>
    </svg>`,

    read: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 气泡 -->
      <path d="M10 12 Q10 6 18 6 L30 6 Q38 6 38 12 L38 28 Q38 34 30 34 L22 34 L14 40 L16 34 L18 34 L10 34 Q10 34 10 28 Z" fill="#4a90d9"/>
      <!-- 已读文字 -->
      <text x="24" y="24" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">已读</text>
    </svg>`,

    photo: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 相机 -->
      <rect x="8" y="16" width="32" height="22" rx="4" fill="#333"/>
      <rect x="8" y="20" width="32" height="18" rx="3" fill="#444"/>
      <!-- 镜头 -->
      <circle cx="24" cy="29" r="8" fill="#222"/>
      <circle cx="24" cy="29" r="5" fill="#1a1a2e"/>
      <circle cx="22" cy="27" r="2" fill="#fff" opacity="0.3"/>
      <!-- 闪光灯 -->
      <circle cx="36" cy="18" r="2" fill="#ffd34d"/>
      <!-- 快门 -->
      <rect x="18" y="14" width="12" height="4" rx="2" fill="#555"/>
    </svg>`,

    // ===== 第二类：战术陷阱/防御型 =====
    mine: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 圆形炸弹 -->
      <circle cx="24" cy="26" r="12" fill="#5a4a3a"/>
      <circle cx="24" cy="26" r="10" fill="#6b5a4a"/>
      <!-- 引线 -->
      <path d="M24 14 Q24 8 30 6" stroke="#8B4513" stroke-width="2" fill="none"/>
      <!-- 火花 -->
      <circle cx="30" cy="6" r="2" fill="#ff6600"/>
      <circle cx="30" cy="6" r="1" fill="#ffd34d"/>
      <!-- 骷髅标记 -->
      <circle cx="21" cy="24" r="1.5" fill="#333"/>
      <circle cx="27" cy="24" r="1.5" fill="#333"/>
      <path d="M21 29 Q24 32 27 29" stroke="#333" stroke-width="1" fill="none"/>
    </svg>`,

    tiaoxiu: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 纸张 -->
      <rect x="10" y="8" width="28" height="32" rx="2" fill="#f5f5dc"/>
      <!-- 折角 -->
      <path d="M32 8 L38 14 L32 14 Z" fill="#e8e8d0"/>
      <!-- 横线 -->
      <line x1="15" y1="18" x2="33" y2="18" stroke="#999" stroke-width="1"/>
      <line x1="15" y1="24" x2="33" y2="24" stroke="#999" stroke-width="1"/>
      <line x1="15" y1="30" x2="33" y2="30" stroke="#999" stroke-width="1"/>
      <!-- 印章 -->
      <circle cx="28" cy="36" r="4" fill="#c0392b" opacity="0.7"/>
      <text x="28" y="38" text-anchor="middle" fill="#fff" font-size="5">休</text>
    </svg>`,

    dabing: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 大饼 -->
      <ellipse cx="24" cy="26" rx="16" ry="10" fill="#f4d03f"/>
      <ellipse cx="24" cy="26" rx="14" ry="8" fill="#f9e79f"/>
      <!-- 花纹 -->
      <circle cx="18" cy="24" r="1" fill="#d4ac0d"/>
      <circle cx="28" cy="22" r="1" fill="#d4ac0d"/>
      <circle cx="24" cy="28" r="1" fill="#d4ac0d"/>
      <!-- 文字 -->
      <text x="24" y="29" text-anchor="middle" fill="#b7950b" font-size="8" font-weight="bold">饼</text>
    </svg>`,

    // ===== 第三类：增益/Buff类 =====
    coffee: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 杯子 -->
      <path d="M14 20 L14 38 Q14 42 24 42 Q34 42 34 38 L34 20 Z" fill="#6b4226"/>
      <path d="M16 22 L16 37 Q16 40 24 40 Q32 40 32 37 L32 22 Z" fill="#8B4513"/>
      <!-- 把手 -->
      <path d="M34 24 Q40 24 40 30 Q40 36 34 36" fill="none" stroke="#6b4226" stroke-width="3"/>
      <!-- 蒸汽 -->
      <path d="M18 16 Q20 12 18 8" stroke="#ddd" stroke-width="1.5" fill="none"/>
      <path d="M24 16 Q26 12 24 8" stroke="#ddd" stroke-width="1.5" fill="none"/>
      <path d="M30 16 Q32 12 30 8" stroke="#ddd" stroke-width="1.5" fill="none"/>
      <!-- 杯口 -->
      <ellipse cx="24" cy="20" rx="10" ry="3" fill="#a0522d"/>
    </svg>`,

    report: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 报纸 -->
      <rect x="10" y="8" width="28" height="32" rx="2" fill="#fff"/>
      <rect x="10" y="8" width="28" height="32" rx="2" fill="none" stroke="#333" stroke-width="2"/>
      <!-- 标题 -->
      <rect x="14" y="12" width="20" height="3" fill="#333"/>
      <rect x="14" y="17" width="14" height="2" fill="#666"/>
      <!-- 图片占位 -->
      <rect x="14" y="22" width="10" height="8" fill="#ddd"/>
      <!-- 正文 -->
      <rect x="27" y="22" width="7" height="2" fill="#999"/>
      <rect x="27" y="26" width="7" height="2" fill="#999"/>
      <rect x="27" y="30" width="5" height="2" fill="#999"/>
      <!-- 底部 -->
      <rect x="14" y="34" width="20" height="2" fill="#ccc"/>
    </svg>`,

    optimize: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 齿轮 -->
      <circle cx="24" cy="24" r="10" fill="#555"/>
      <circle cx="24" cy="24" r="6" fill="#333"/>
      <!-- 齿轮齿 -->
      <rect x="22" y="10" width="4" height="4" rx="1" fill="#555"/>
      <rect x="22" y="34" width="4" height="4" rx="1" fill="#555"/>
      <rect x="10" y="22" width="4" height="4" rx="1" fill="#555"/>
      <rect x="34" y="22" width="4" height="4" rx="1" fill="#555"/>
      <rect x="13" y="13" width="4" height="4" rx="1" fill="#555" transform="rotate(45 15 15)"/>
      <rect x="31" y="13" width="4" height="4" rx="1" fill="#555" transform="rotate(45 33 15)"/>
      <rect x="13" y="31" width="4" height="4" rx="1" fill="#555" transform="rotate(45 15 33)"/>
      <rect x="31" y="31" width="4" height="4" rx="1" fill="#555" transform="rotate(45 33 33)"/>
      <!-- 箭头(优化象征) -->
      <path d="M24 18 L24 30 M20 24 L24 30 L28 24" stroke="#ffd34d" stroke-width="2" fill="none"/>
    </svg>`,

    // ===== 第四类：终极技能 =====
    ult_moyu: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 墨镜脸 -->
      <circle cx="24" cy="24" r="14" fill="#ffd2b8"/>
      <!-- 墨镜 -->
      <rect x="12" y="20" width="10" height="6" rx="3" fill="#111"/>
      <rect x="26" y="20" width="10" height="6" rx="3" fill="#111"/>
      <line x1="22" y1="23" x2="26" y2="23" stroke="#111" stroke-width="2"/>
      <!-- 微笑 -->
      <path d="M18 32 Q24 36 30 32" stroke="#333" stroke-width="2" fill="none"/>
      <!-- 光环 -->
      <circle cx="24" cy="24" r="16" fill="none" stroke="#ffd34d" stroke-width="1" opacity="0.5"/>
    </svg>`,

    ult_meeting: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 喇叭/警报器 -->
      <path d="M12 20 L12 28 L22 32 L36 16 Z" fill="#ff5d6c"/>
      <path d="M36 16 L42 13 L42 35 L36 32" fill="#ff8a80"/>
      <!-- 声波 -->
      <path d="M44 18 Q48 24 44 30" stroke="#ff5d6c" stroke-width="2" fill="none"/>
      <path d="M46 15 Q52 24 46 33" stroke="#ff5d6c" stroke-width="2" fill="none"/>
      <!-- 文字 -->
      <text x="24" y="27" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">开会!</text>
    </svg>`,

    ult_bomb: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 手机 -->
      <rect x="16" y="8" width="16" height="30" rx="3" fill="#333"/>
      <rect x="18" y="12" width="12" height="22" fill="#4a90d9"/>
      <!-- 消息气泡 -->
      <rect x="20" y="16" width="8" height="3" rx="1" fill="#fff"/>
      <rect x="20" y="21" width="6" height="2" rx="1" fill="#fff" opacity="0.7"/>
      <rect x="20" y="25" width="7" height="2" rx="1" fill="#fff" opacity="0.7"/>
      <!-- 红色未读数 -->
      <circle cx="30" cy="12" r="4" fill="#ff0000"/>
      <text x="30" y="14" text-anchor="middle" fill="#fff" font-size="6" font-weight="bold">99+</text>
      <!-- 底部按钮 -->
      <circle cx="24" cy="37" r="2" fill="#555"/>
    </svg>`,

    // ===== 第五类：工时券消耗品 =====
    weather: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 云 -->
      <path d="M14 22 Q14 16 20 16 Q22 10 30 12 Q36 12 36 18 Q42 18 42 24 Q42 30 36 30 L16 30 Q10 30 10 24 Q10 22 14 22 Z" fill="#8899aa"/>
      <!-- 雨滴 -->
      <line x1="18" y1="34" x2="16" y2="40" stroke="#4a90d9" stroke-width="2"/>
      <line x1="24" y1="34" x2="22" y2="40" stroke="#4a90d9" stroke-width="2"/>
      <line x1="30" y1="34" x2="28" y2="40" stroke="#4a90d9" stroke-width="2"/>
    </svg>`,

    readback: `<svg viewBox="0 0 48 48" width="40" height="40">
      <!-- 对话框 -->
      <path d="M8 12 Q8 8 14 8 L34 8 Q40 8 40 12 L40 30 Q40 36 34 36 L24 36 L16 42 L18 36 L14 36 Q8 36 8 30 Z" fill="#9b59b6"/>
      <!-- 错误文字 -->
      <text x="24" y="20" text-anchor="middle" fill="#fff" font-size="8" font-weight="bold">404</text>
      <text x="24" y="30" text-anchor="middle" fill="#ffcccb" font-size="6">乱回</text>
    </svg>`,
  };

  return icons[type] || '';
}

/** 获取图标的主色调(用于卡片背景渐变) */
export function getIconColor(type) {
  const colors = {
    sunflower: ['#ffd34d', '#ffb300'],
    peashooter: ['#2a4a8a', '#1a3060'],
    wallnut: ['#b8863a', '#5a3a18'],
    auditor: ['#1a3a5a', '#c0392b'],
    hammer: ['#666', '#8B4513'],
    shield: ['#4a6fa5', '#ffd34d'],
    read: ['#4a90d9', '#88ccff'],
    photo: ['#333', '#444'],
    mine: ['#5a4a3a', '#ff6600'],
    tiaoxiu: ['#f5f5dc', '#c0392b'],
    dabing: ['#f4d03f', '#f9e79f'],
    coffee: ['#6b4226', '#8B4513'],
    report: ['#fff', '#333'],
    optimize: ['#555', '#ffd34d'],
    ult_moyu: ['#ffd2b8', '#ffd34d'],
    ult_meeting: ['#ff5d6c', '#ff8a80'],
    ult_bomb: ['#333', '#4a90d9'],
    weather: ['#8899aa', '#4a90d9'],
    readback: ['#9b59b6', '#ffcccb'],
  };
  return colors[type] || ['#4a90d9', '#1a3060'];
}
