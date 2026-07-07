import sunflowerPortrait from './cards/icon-sunflower.png';
import clientZombiePortrait from './cards/icon-client-zombie.png';

const CARD_ART = {
  sunflower: sunflowerPortrait,
};

const ENEMY_ART = {
  client: clientZombiePortrait,
};

export function getCardArt(type) {
  return CARD_ART[type] || null;
}

export function getEnemyArt(type) {
  return ENEMY_ART[type] || null;
}

