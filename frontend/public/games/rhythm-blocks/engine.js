// Game Engine

class Engine {
  constructor() {
    this.renderer = new window.Renderer('game-canvas');
    this.audio = new window.AudioEngine();
    this.input = new window.InputSystem(6);
    this.bridge = window.Bridge;

    this.state = {
      score: 0,
      combo: 0,
      multiplier: 1.0,
      maxCombo: 0,
      notes: [], // Active notes
      effects: [], // Visual effects
      currentTime: 0,
      scrollSpeed: 0.6, // px/ms
      isPlaying: false,
      isGameOver: false
    };

    // Judgement Windows (ms) +/-
    this.windows = {
      perfect: 40,
      great: 80,
      good: 120,
      miss: 150
    };

    // Score Values
    this.scores = {
      perfect: 100,
      great: 70,
      good: 40
    };

    this.seed = window.Utils.getDailySeed();
    this.chart = null;
    this.lastFrameTime = 0;
  }

  init() {
    this.bridge.init();
    this.renderer.resize();
    window.addEventListener('resize', () => this.renderer.resize());

    this.input.init((lane, time) => this.handleInput(lane, time));

    // Check URL params for seed or chart
    const params = new URLSearchParams(window.location.search);
    this.offset = parseInt(localStorage.getItem('rhythm-blocks-offset') || '0', 10);

    if (params.get('seed')) {
      this.seed = params.get('seed');
      this.generateChart(this.seed);
    } else if (params.get('chart')) {
      this.loadChart(params.get('chart'));
    } else {
      // Default to daily seed
      this.generateChart(this.seed);
    }

    document.getElementById('seed-display').innerText = this.seed;

    document.getElementById('start-btn').addEventListener('click', () => {
        this.start();
        document.getElementById('start-overlay').classList.add('hidden');
    });

    this.loop = this.loop.bind(this);
  }

  async loadChart(chartName) {
      try {
          const res = await fetch(`charts/${chartName}.json`);
          if (!res.ok) throw new Error("Chart not found");
          this.chart = await res.json();
          this.state.notes = JSON.parse(JSON.stringify(this.chart.notes));
          console.log(`[Engine] Loaded chart: ${chartName}`);
          document.getElementById('seed-display').innerText = this.chart.title || chartName;
      } catch (e) {
          console.error(e);
          this.generateChart(this.seed);
      }
  }

  generateChart(seed) {
    // Procedural Generation using Utils.mulberry32
    // 1. Create seeded RNG
    const seedParts = window.Utils.cyrb128(seed);
    const rand = window.Utils.mulberry32(seedParts[0]);

    this.chart = {
        title: "Procedural Mix",
        notes: [],
        lengthMs: 60000 // 1 minute song
    };

    const bpm = 120;
    const msPerBeat = 60000 / bpm;
    let time = 2000; // Start delay

    // Generate patterns
    while (time < this.chart.lengthMs) {
        // Density checks
        const density = rand();

        // Pattern: Single
        if (density < 0.6) {
            const lane = Math.floor(rand() * 6);
            this.chart.notes.push({ timeMs: time, lane: lane, hit: false });
        }
        // Pattern: Double (Jumps)
        else if (density < 0.8) {
             const lane1 = Math.floor(rand() * 6);
             let lane2 = Math.floor(rand() * 6);
             while (lane2 === lane1) lane2 = Math.floor(rand() * 6);
             this.chart.notes.push({ timeMs: time, lane: lane1, hit: false });
             this.chart.notes.push({ timeMs: time, lane: lane2, hit: false });
        }
        // Pattern: Stream (4 notes in sequence)
        else {
             for(let i=0; i<4; i++) {
                 const t = time + (i * msPerBeat / 2); // 8th notes
                 const lane = Math.floor(rand() * 6);
                 this.chart.notes.push({ timeMs: t, lane: lane, hit: false });
             }
        }

        time += msPerBeat;
    }

    // Load notes into state
    this.state.notes = JSON.parse(JSON.stringify(this.chart.notes));
    console.log(`[Engine] Generated ${this.state.notes.length} notes for seed ${seed}`);
  }

  start() {
    this.audio.resume(); // Ensure context is running
    this.audio.play();
    this.state.isPlaying = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  loop() {
    if (!this.state.isPlaying) return;

    // Time Sync
    const now = performance.now();
    // Use audio time as master
    this.state.currentTime = this.audio.getCurrentTimeMs();

    // Fallback if audio not playing yet or ended?
    if (this.state.currentTime > this.chart.lengthMs + 2000) {
        this.endGame();
        return;
    }

    // Update Logic
    this.updateNotes();
    this.updateEffects();

    // Render
    this.renderer.draw(this.state);

    requestAnimationFrame(this.loop);
  }

  updateNotes() {
    // Check for missed notes
    const missWindow = this.windows.miss;

    this.state.notes.forEach(note => {
        if (!note.hit && !note.missed) {
            if (this.state.currentTime > note.timeMs + missWindow) {
                note.missed = true;
                this.handleMiss(note);
            }
        }
    });
  }

  updateEffects() {
      // Remove old effects
      const now = Date.now();
      this.state.effects = this.state.effects.filter(e => now - e.startTime < 1000);
  }

  handleInput(lane, _inputTime) {
      if (!this.state.isPlaying) return;

      // Use current audio time for judgement to ensure sync with music
      // Apply user calibration offset:
      // If user is late (latency), they hit AFTER the note.
      // Offset should shift the window.
      // Usually: CorrectedTime = AudioTime - Offset
      const currentTime = this.audio.getCurrentTimeMs() - this.offset;

      // Find nearest hittable note in this lane
      // We search notes that are not hit, not missed, and within Miss window

      // Filter candidates
      const candidates = this.state.notes.filter(n =>
          n.lane === lane &&
          !n.hit &&
          !n.missed &&
          Math.abs(n.timeMs - currentTime) <= this.windows.miss
      );

      if (candidates.length === 0) {
          // Ghost tap / misfire?
          // Optional: penalty for spamming
          return;
      }

      // Pick the closest one
      candidates.sort((a,b) => Math.abs(a.timeMs - currentTime) - Math.abs(b.timeMs - currentTime));
      const targetNote = candidates[0];

      this.judgeHit(targetNote, currentTime);
  }

  judgeHit(note, hitTime) {
      const diff = Math.abs(note.timeMs - hitTime);
      note.hit = true; // Mark as hit so we don't hit it again

      let score = 0;
      let text = "";
      let color = "";

      if (diff <= this.windows.perfect) {
          score = this.scores.perfect;
          text = "PERFECT";
          color = "#00e676"; // Bright Green
          this.audio.playHitSound('perfect');
      } else if (diff <= this.windows.great) {
          score = this.scores.great;
          text = "GREAT";
          color = "#2979ff"; // Blue
          this.audio.playHitSound('great');
      } else if (diff <= this.windows.good) {
          score = this.scores.good;
          text = "GOOD";
          color = "#ffea00"; // Yellow
          this.audio.playHitSound('good');
      } else {
          // Late miss (within miss window but outside good)
          // Actually if we are here, we are <= windows.miss
          // So treat as Good or Bad? Let's say Bad/Miss equivalent or poor
          this.handleMiss(note);
          return;
      }

      this.addScore(score);
      this.incrementCombo();
      this.spawnEffect(note.lane, text, color);
  }

  handleMiss(note) {
      // note.missed is already set if time passed, but if input triggered this:
      note.missed = true;
      this.resetCombo();
      this.spawnEffect(note.lane, "MISS", "#ff1744");
  }

  addScore(baseScore) {
      const added = Math.round(baseScore * this.state.multiplier);
      this.state.score += added;
  }

  incrementCombo() {
      this.state.combo++;
      if (this.state.combo > this.state.maxCombo) {
          this.state.maxCombo = this.state.combo;
      }

      // Update multiplier
      // Every 10 hits +0.1, cap at 2.0
      // Base 1.0
      const bonus = Math.floor(this.state.combo / 10) * 0.1;
      this.state.multiplier = Math.min(2.0, 1.0 + bonus);
  }

  resetCombo() {
      this.state.combo = 0;
      this.state.multiplier = 1.0;
  }

  spawnEffect(lane, text, color) {
      this.state.effects.push({
          lane: lane,
          text: text,
          color: color,
          startTime: Date.now()
      });
  }

  endGame() {
      this.state.isPlaying = false;
      this.audio.stop();
      console.log("Game Over. Final Score:", this.state.score);

      this.bridge.submitScore(this.state.score, {
          seed: this.seed,
          maxCombo: this.state.maxCombo,
          perfects: this.state.notes.filter(n => n.hit).length // Approximation
      });

      // Simple alert or overlay
      alert(`Track Complete! Score: ${this.state.score}\nMax Combo: ${this.state.maxCombo}`);
      // Reload for now or show replay button
      window.location.reload();
  }
}

window.Engine = Engine;
