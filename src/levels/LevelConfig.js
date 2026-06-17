/**
 * 关卡配置表：6关渐进式挑战
 * 每关包含：波次列表、解锁道具、特供道具、初始资源
 * 基础道具(向日葵+豌豆射手)每关始终可用，不需要在 unlocks 中列出
 */

// 单波次配置：{ zombies: [{type, count, delay, hpMul}], interval }
// delay: 该波僵尸生成间隔(秒)；hpMul: 血量倍率
const W = (zombies, interval = 1.5) => ({ zombies, interval });

export const LEVELS = [
  // ===== LEVEL 1: 新手保护期 =====
  {
    id: 1,
    name: '新手保护期',
    icon: '🌱',
    desc: '刚入职，先熟悉工位环境',
    startResource: 50,
    waves: [
      W([{ type: 'client', count: 2, delay: 2 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }]),
      W([{ type: 'client', count: 3, delay: 1.5, hpMul: 1.5 }]),
    ],
    unlocks: ['wallnut', 'hammer'],
    special: { type: 'dabing', name: '大饼诱饵', desc: '吸引甲方僵尸啃食聚怪', limit: 3 },
  },

  // ===== LEVEL 2: KPI风暴 =====
  {
    id: 2,
    name: 'KPI风暴',
    icon: '📊',
    desc: '月度绩效评估，KPI压死人',
    startResource: 60,
    waves: [
      W([{ type: 'client', count: 2, delay: 1.5 }, { type: 'kpi', count: 1, delay: 2 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 1, delay: 2 }]),
      W([{ type: 'client', count: 2, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.8 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5, hpMul: 1.3 }]),
    ],
    unlocks: ['auditor', 'tiaoxiu'],
    special: { type: 'report', name: '日报生成器', desc: '向日葵产出×3持续15秒', limit: 2 },
  },

  // ===== LEVEL 3: 甲方地狱 =====
  {
    id: 3,
    name: '甲方地狱',
    icon: '📝',
    desc: '甲方疯狂改需求，僵尸来回冲锋',
    startResource: 70,
    waves: [
      W([{ type: 'client', count: 3, delay: 1.2 }, { type: 'kpi', count: 1, delay: 2 }]),
      W([{ type: 'client', count: 4, delay: 1.2 }, { type: 'kpi', count: 1, delay: 2 }]),
      W([{ type: 'client', count: 3, delay: 1.2 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 4, delay: 1.2 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 5, delay: 1.0, hpMul: 1.2 }, { type: 'kpi', count: 2, delay: 1.5 }]),
    ],
    unlocks: ['shield', 'read'],
    special: { type: 'optimize', name: '反向优化', desc: '坚果墙满血+50%上限', limit: 2 },
    flags: { clientDoubleRevert: true }, // 甲方需求变更频率翻倍
  },

  // ===== LEVEL 4: 老板巡视 =====
  {
    id: 4,
    name: '老板巡视',
    icon: '👑',
    desc: '老板亲自到工位巡视，随时开除员工',
    startResource: 80,
    waves: [
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }]),
    ],
    unlocks: ['coffee', 'mine', 'readback'],
    special: { type: 'coffee_boost', name: '续命咖啡强化版', desc: '回血40%+攻速×1.5持续12秒', limit: 2 },
  },

  // ===== LEVEL 5: 工贼叛乱 =====
  {
    id: 5,
    name: '工贼叛乱',
    icon: '😈',
    desc: '办公室出叛徒，向日葵被策反',
    startResource: 90,
    waves: [
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'traitor', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'traitor', count: 2, delay: 3 }]),
    ],
    unlocks: ['photo', 'weather'],
    special: { type: 'emergency_report', name: '应急日报系统', desc: '向日葵产出+100并免疫策反15秒', limit: 2 },
  },

  // ===== LEVEL 6: 年终决战 =====
  {
    id: 6,
    name: '年终决战',
    icon: '🏆',
    desc: '年终总结大会，全体老板齐聚',
    startResource: 100,
    waves: [
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 4, delay: 1.5 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'traitor', count: 1, delay: 0 }]),
      W([{ type: 'client', count: 3, delay: 1.5 }, { type: 'kpi', count: 3, delay: 1.5 }, { type: 'boss', count: 2, delay: 3 }]),
      W([{ type: 'client', count: 5, delay: 1.2 }, { type: 'kpi', count: 2, delay: 1.5 }, { type: 'boss', count: 1, delay: 0 }, { type: 'traitor', count: 1, delay: 5 }]),
      W([{ type: 'boss', count: 2, delay: 3 }, { type: 'traitor', count: 1, delay: 2 }]),
      W([{ type: 'boss', count: 3, delay: 2.5 }, { type: 'traitor', count: 2, delay: 3 }]),
      W([{ type: 'super_traitor', count: 1, delay: 0 }]), // 超级工贼
    ],
    unlocks: ['ult_moyu', 'ult_meeting', 'ult_bomb'],
    special: { type: 'year_bonus', name: '年终奖炸弹', desc: '全屏僵尸扣50%血+眩晕5秒', limit: 1 },
  },
];

// 全部已解锁道具的累计计算(基础+各关解锁)
export const BASE_PLANTS = ['sunflower', 'peashooter'];

/** 获取到第N关时所有可用道具(含基础) */
export function getUnlockedItems(levelId) {
  const items = [...BASE_PLANTS];
  for (const lv of LEVELS) {
    if (lv.id <= levelId) {
      if (lv.unlocks) items.push(...lv.unlocks);
    }
  }
  return items;
}

/** 获取指定关卡配置 */
export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || null;
}
