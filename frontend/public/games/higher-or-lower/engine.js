const SUITS = ['♠', '♥', '♣', '♦'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export class GameEngine {
  constructor(seed, mode = 'arcade') {
    this.seed = seed;
    this.mode = mode;
    this.rng = null; // Set in init
    this.deck = [];
    this.discardPile = [];
    this.currentCard = null;
    this.nextCard = null;
    this.score = 0;
    this.streak = 0;
    this.streakMax = 0;
    this.correctCount = 0;
    this.roundsPlayed = 0;
    this.gameOver = false;

    // Powerups
    this.shieldActive = false;
    this.shieldUsed = false;
    this.hintUsed = false;
    this.doubleOrNothingActive = false;

    // Constants
    this.BASE_POINTS = 10;
    this.MONEY_LADDER = [
      100, 200, 300, 500, 1000,
      2000, 4000, 8000, 16000, 32000,
      64000, 125000, 250000, 500000, 1000000
    ];
    this.CHECKPOINTS = [4, 9]; // Indices of safe havens ($1,000 and $32,000)

    // Millionaire State
    this.ladderIndex = -1; // -1 means haven't won anything yet
    this.lifelines = {
      audience: true,
      phone: true,
      swap: true
    };
  }

  init(rngFunc) {
    this.rng = rngFunc;
    this.createDeck();
    this.shuffleDeck();
    this.drawInitialCards();

    // Reset specific mode states
    if (this.mode === 'millionaire') {
      this.ladderIndex = -1;
      this.lifelines = { audience: true, phone: true, swap: true };
    }
  }

  createDeck() {
    this.deck = [];
    for (let s of SUITS) {
      for (let r of RANKS) {
        this.deck.push({
          suit: s,
          rank: r,
          value: VALUES[r],
          color: (s === '♥' || s === '♦') ? 'red' : 'black'
        });
      }
    }
  }

  shuffleDeck() {
    // Fisher-Yates with seeded RNG
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  drawInitialCards() {
    if (this.deck.length === 0) return; // Should not happen on init
    this.currentCard = this.deck.pop();
    // Peek next card logic is handled dynamically, we just need to ensure deck has cards
    if (this.deck.length === 0) {
        // Reshuffle if empty? For MVP we assume one deck pass or reshuffle.
        // Let's implement reshuffle of discard if empty
        this.reshuffleDiscard();
    }
  }

  reshuffleDiscard() {
    if (this.discardPile.length === 0) {
      // Create new deck if absolutely everything is gone
      this.createDeck();
    } else {
      this.deck = [...this.discardPile];
      this.discardPile = [];
    }
    this.shuffleDeck();
  }

  getNextCard() {
    if (this.deck.length === 0) {
      this.reshuffleDiscard();
    }
    return this.deck[this.deck.length - 1]; // Peek
  }

  dealNext() {
      // Actually move next card to current
      if (this.deck.length === 0) this.reshuffleDiscard();
      this.discardPile.push(this.currentCard);
      this.currentCard = this.deck.pop();
  }

  guess(choice) { // 'higher' or 'lower'
    if (this.gameOver) return { result: 'game_over' };

    const next = this.getNextCard();
    const currentVal = this.currentCard.value;
    const nextVal = next.value;

    let correct = false;
    if (choice === 'higher' && nextVal >= currentVal) correct = true;
    if (choice === 'lower' && nextVal <= currentVal) correct = true;

    // --- MILLIONAIRE MODE ---
    if (this.mode === 'millionaire') {
      if (correct) {
        this.ladderIndex++;
        this.dealNext();

        const money = this.MONEY_LADDER[this.ladderIndex];
        const isWin = this.ladderIndex === this.MONEY_LADDER.length - 1;

        if (isWin) {
          this.gameOver = true;
          return { result: 'win_big', money: money, card: this.currentCard };
        }

        return { result: 'correct', money: money, card: this.currentCard, level: this.ladderIndex };
      } else {
        // Find last checkpoint
        let prize = 0;
        for (let cp of this.CHECKPOINTS) {
          if (this.ladderIndex >= cp) prize = this.MONEY_LADDER[cp];
        }

        this.gameOver = true;
        this.dealNext();
        return { result: 'game_over', prize: prize, card: this.currentCard };
      }
    }

    // --- STREAK MODE & CLASSIC ---
    // Handle Double or Nothing logic (Classic only)
    let points = 0;
    let multiplier = 1 + 0.2 * (this.streak);

    if (this.mode === 'streak') {
        multiplier = 1; // Pure count
    }

    if (this.doubleOrNothingActive && this.mode === 'arcade') {
        if (correct) {
            multiplier *= 2;
        }
        this.doubleOrNothingActive = false;
    }

    if (correct) {
      points = Math.floor(this.BASE_POINTS * multiplier);
      if (this.mode === 'streak') points = 1; // 1 point per correct guess

      this.score += points;
      this.streak++;
      if (this.streak > this.streakMax) this.streakMax = this.streak;
      this.correctCount++;

      // Advance cards
      this.dealNext();

      return { result: 'correct', points, card: this.currentCard };
    } else {
      // Incorrect
      if (this.shieldActive && !this.shieldUsed) {
          this.shieldUsed = true; // Consumed
          this.dealNext();
          return { result: 'saved', points: 0, card: this.currentCard };
      }

      this.gameOver = true;
      this.roundsPlayed++;
      this.dealNext();
      return { result: 'game_over', points: 0, card: this.currentCard };
    }
  }

  activatePowerup(type) {
      // Millionaire Lifelines
      if (this.mode === 'millionaire') {
        if (type === 'audience' && this.lifelines.audience) {
          this.lifelines.audience = false;
          const next = this.getNextCard();
          // Simulate audience: 80% chance to be right
          const isHigher = next.value >= this.currentCard.value;
          const isRight = Math.random() < 0.8;
          const voteHigher = isRight ? isHigher : !isHigher;
          const percent = 70 + Math.floor(Math.random() * 25);
          return {
             vote: voteHigher ? 'higher' : 'lower',
             percent: percent
          };
        }
        if (type === 'phone' && this.lifelines.phone) {
          this.lifelines.phone = false;
          const next = this.getNextCard();
          // Simulate friend: 60% chance to be right
          const isHigher = next.value >= this.currentCard.value;
          const isRight = Math.random() < 0.6;
          const guess = isRight ? (isHigher ? 'Higher' : 'Lower') : (isHigher ? 'Lower' : 'Higher');
          const phrases = [
            `I'm pretty sure it's ${guess}.`,
            `Uhhh... maybe ${guess}?`,
            `My gut says ${guess}, but don't blame me!`,
            `Definitely ${guess}. Trust me.`
          ];
          return { message: phrases[Math.floor(Math.random() * phrases.length)] };
        }
        if (type === 'swap' && this.lifelines.swap) {
          this.lifelines.swap = false;
          this.dealNext(); // Skip current card
          return { newCard: this.currentCard };
        }
        return false;
      }

      // Classic Powerups
      if (type === 'shield' && !this.shieldUsed) {
          this.shieldActive = true;
          return true;
      }
      if (type === 'hint' && !this.hintUsed) {
          this.hintUsed = true;
          const next = this.getNextCard();
          return {
              color: next.color,
              range: next.value >= 8 ? 'High (8-A)' : 'Low (2-7)'
          };
      }
      if (type === 'double') {
          this.doubleOrNothingActive = true;
          return true;
      }
      return false;
  }
}
