import { save, load } from './persistence.js';

// Non-hat shop goods — boat sails and campfire flame hues. One good of each
// kind can be active; appliers (registered by main) turn the choice into
// world changes. All per-device: sails and flame colours are personal style.

export const GOODS = {
  sailCrimson:   { label: 'Crimson Sail',   price: 40, kind: 'sail',  value: 0xC83A3A },
  sailTeal:      { label: 'Teal Sail',      price: 40, kind: 'sail',  value: 0x2AA8A0 },
  sailGold:      { label: 'Golden Sail',    price: 60, kind: 'sail',  value: 0xE8C050 },
  flameViolet:   { label: 'Violet Flame',   price: 60, kind: 'flame', value: 0xA85CF0 },
  flameEmerald:  { label: 'Emerald Flame',  price: 60, kind: 'flame', value: 0x50E890 },
  flameSapphire: { label: 'Sapphire Flame', price: 60, kind: 'flame', value: 0x50A8FF },
};

let _appliers = {};

export function initGoods(appliers) {
  _appliers = appliers;
  for (const kind of ['sail', 'flame']) {
    const id = activeGood(kind);
    if (id && GOODS[id]) _appliers[kind]?.(GOODS[id].value);
  }
}

export const ownedGoods = () => load('goods:owned', []);
export const activeGood = kind => load(`goods:active:${kind}`, null);

export function grantGood(id) {
  const owned = ownedGoods();
  if (owned.includes(id)) return false;
  owned.push(id);
  save('goods:owned', owned);
  return true;
}

// id null → revert that kind to default
export function useGood(kind, id) {
  save(`goods:active:${kind}`, id);
  _appliers[kind]?.(id && GOODS[id] ? GOODS[id].value : null);
}
