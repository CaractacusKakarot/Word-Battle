// src/game/battleEngine.js

// ============================
// PLAYER / BOT DEFAULT STATE
// ============================

export function createFighter(name, isBot = false) {
  return {
    name,
    isBot,
    hp: 100,
    maxHp: 100,
    battleXP: 0,
    shield: 0,
    stunned: false,
    summon: null, // future use
  };
}

// ============================
// XP HANDLING
// ============================

export function awardXP(fighter, amount) {
  fighter.battleXP += amount;
  return fighter.battleXP;
}

// ============================
// DAMAGE + DEFENSE
// ============================

export function applyDamage(target, amount) {
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    amount -= absorbed;
  }

  if (amount > 0) {
    target.hp = Math.max(0, target.hp - amount);
  }

  return target.hp;
}

// ============================
// ABILITIES
// ============================

export function basicAttack(attacker, defender) {
  if (attacker.battleXP < 5) return false;
  attacker.battleXP -= 5;
  applyDamage(defender, 10);
  return true;
}

export function heavyAttack(attacker, defender) {
  if (attacker.battleXP < 10) return false;
  attacker.battleXP -= 10;
  applyDamage(defender, 20);
  return true;
}

export function heal(fighter) {
  if (fighter.battleXP < 10) return false;
  fighter.battleXP -= 10;
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + 20);
  return true;
}

export function shield(fighter) {
  if (fighter.battleXP < 7) return false;
  fighter.battleXP -= 7;
  fighter.shield += 15;
  return true;
}

// ============================
// ROUND RESOLUTION
// ============================

export function resolveRound(winner, loser) {
  awardXP(winner, 3);
  applyDamage(loser, 5);
}

// ============================
// MATCH STATE CHECKS
// ============================

export function isDefeated(fighter) {
  return fighter.hp <= 0;
}
