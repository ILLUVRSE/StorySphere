// waves.js

export class WaveManager {
  constructor(rng) {
    this.rng = rng;
    this.definitions = [
      { duration: 30000, spawnRate: 3000, vipChance: 0.0, maxActive: 5 },  // Warmup
      { duration: 45000, spawnRate: 2000, vipChance: 0.1, maxActive: 10 }, // Build up
      { duration: 60000, spawnRate: 1500, vipChance: 0.2, maxActive: 15 }, // Pressure
      { duration: 45000, spawnRate: 1000, vipChance: 0.3, maxActive: 20 }, // Rush
      { duration: 999999, spawnRate: 800, vipChance: 0.5, maxActive: 30 }   // Infinite hard
    ];
  }

  getWave(index) {
    if (index >= this.definitions.length) {
      return this.definitions[this.definitions.length - 1];
    }
    return this.definitions[index];
  }
}
