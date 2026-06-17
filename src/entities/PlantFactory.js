import { Plant } from './Plant.js';
import { Sunflower } from './Sunflower.js';
import { Peashooter } from './Peashooter.js';
import { Wallnut } from './Wallnut.js';

/**
 * 工厂：根据类型创建植物实例
 * 单独文件避免 Plant.js 与子类的循环引用
 */
export function createPlant(scene, type, row, col, grid) {
  switch (type) {
    case 'sunflower':  return new Sunflower(scene, type, row, col, grid);
    case 'peashooter': return new Peashooter(scene, type, row, col, grid);
    case 'wallnut':    return new Wallnut(scene, type, row, col, grid);
    default: return null;
  }
}
