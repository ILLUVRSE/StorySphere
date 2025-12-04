export const GLADIATORS = {
  BRUISER: {
    id: 'bruiser',
    name: 'Bruiser',
    hp: 140,
    speed: 3.5,
    radius: 0.35,
    color: '#d32f2f', // Red
    abilities: [
      {
        id: 'dash_smash',
        name: 'Dash Smash',
        cooldown: 5000, // ms
        duration: 400,
        type: 'active',
        desc: 'Dash forward, dealing damage on impact.'
      },
      {
        id: 'shield',
        name: 'Iron Skin',
        cooldown: 8000,
        duration: 3000,
        type: 'buff',
        desc: 'Reduce incoming damage by 70%.'
      }
    ]
  },
  SHARPSHOOTER: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    hp: 90,
    speed: 4.2,
    radius: 0.3,
    color: '#0288d1', // Blue
    abilities: [
      {
        id: 'snipe',
        name: 'Snipe',
        cooldown: 1500,
        type: 'projectile',
        speed: 12,
        damage: 35,
        range: 12,
        desc: 'Long range high velocity shot.'
      },
      {
        id: 'stun_grenade',
        name: 'Stun Grenade',
        cooldown: 6000,
        type: 'projectile',
        speed: 8,
        damage: 10,
        aoe: 1.5,
        stun: 1500,
        desc: 'Explodes stunning enemies in range.'
      }
    ]
  },
  TRICKSTER: {
    id: 'trickster',
    name: 'Trickster',
    hp: 100,
    speed: 4.5,
    radius: 0.3,
    color: '#7b1fa2', // Purple
    abilities: [
      {
        id: 'blink',
        name: 'Blink',
        cooldown: 4000,
        range: 4,
        type: 'active',
        desc: 'Teleport forward instantly.'
      },
      {
        id: 'mine',
        name: 'Trap Mine',
        cooldown: 7000,
        type: 'deploy',
        damage: 40,
        desc: 'Place a hidden mine.'
      }
    ]
  }
};
