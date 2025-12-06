// Wheel configuration
export const WHEEL_SECTORS = [
    { type: 'CASH', value: 500, color: '#f44336' }, // Red
    { type: 'JACKPOT', value: 0, label: 'JACKPOT', color: '#ffd700', textColor: '#000' }, // Gold - Jackpot
    { type: 'CASH', value: 200, color: '#ffeb3b' }, // Yellow
    { type: 'LOSE_TURN', value: 0, label: 'LOSE', color: '#ffffff' }, // White
    { type: 'CASH', value: 400, color: '#4caf50' }, // Green
    { type: 'MYSTERY', value: 0, label: 'MYSTERY', color: '#000000', textColor: '#fff' }, // Mystery
    { type: 'CASH', value: 900, color: '#3f51b5' }, // Indigo
    { type: 'BANKRUPT', value: 0, label: 'BANK', color: '#000000', textColor: '#ffffff' }, // Black
    { type: 'CASH', value: 600, color: '#9c27b0' }, // Purple
    { type: 'CASH', value: 300, color: '#e91e63' }, // Pink
    { type: 'CASH', value: 250, color: '#795548' }, // Brown
    { type: 'CASH', value: 1000, color: '#ffd700' }, // Gold
    { type: 'CASH', value: 100, color: '#607d8b' }, // Blue Grey
    { type: 'CASH', value: 550, color: '#00bcd4' }, // Cyan
    { type: 'FREE_SPIN', value: 0, label: 'FREE', color: '#8bc34a' }, // Light Green
    { type: 'CASH', value: 350, color: '#cddc39' }, // Lime
];

export const VOWELS = ['A', 'E', 'I', 'O', 'U'];
export const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ".split('');
export const VOWEL_COST = 250;

export class WheelEngine {
    constructor(puzzles, seed, playerNames = ['PLAYER 1']) {
        this.puzzles = puzzles;
        this.rng = seed; // Function
        this.currentPuzzleIndex = 0;

        // Players Setup
        this.players = playerNames.map(name => ({
            name: name,
            roundCash: 0,
            bank: 0, // Total score banked from previous rounds
            inventory: [], // 'FREE_SPIN' tokens
        }));
        this.currentPlayerIndex = 0;
        this.jackpot = 5000; // Progressive Jackpot

        this.maxPuzzles = 5;

        this.state = 'SPIN'; // SPIN, SPINNING, RESULT, GUESS_CONSONANT, BUY_ACTION, SOLVE_INPUT, ROUND_END, GAME_OVER
        this.puzzle = null;
        this.revealed = []; // Array of booleans
        this.guessedLetters = new Set();

        this.wheelAngle = 0;
        this.wheelVelocity = 0;
        this.currentSector = null;

        // Single frame event flag for renderer to consume
        this.lastEffect = null;

        this.message = `${this.getCurrentPlayer().name}, SPIN!`;

        this.loadNextPuzzle();
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.message = `${this.getCurrentPlayer().name}'S TURN`;
        this.state = 'SPIN';
    }

    loadNextPuzzle() {
        if (this.currentPuzzleIndex >= this.maxPuzzles) {
            this.state = 'GAME_OVER';
            // Determine winner
            const winner = this.players.reduce((prev, current) => (prev.bank > current.bank) ? prev : current);
            this.message = `GAME OVER! ${winner.name} WINS $${winner.bank}!`;
            this.lastEffect = { type: 'PARTICLES', color: '#ffd700' }; // Winner confetti
            return;
        }

        const p = this.puzzles[this.currentPuzzleIndex % this.puzzles.length];
        this.puzzle = {
            category: p.category,
            text: p.text.toUpperCase(),
            grid: this.createPuzzleGrid(p.text.toUpperCase())
        };
        this.revealed = this.puzzle.text.split('').map(c => !/[A-Z]/.test(c)); // Auto reveal non-letters
        this.guessedLetters.clear();

        // Reset round cash for everyone? No, usually rules vary but let's keep round cash per puzzle.
        // Actually standard rules: Round cash is lost if you don't solve. Only solver banks.
        this.players.forEach(p => p.roundCash = 0);

        this.state = 'SPIN';
        this.message = `${this.getCurrentPlayer().name}, SPIN! (${this.puzzle.category})`;
    }

    createPuzzleGrid(text) {
        const words = text.split(' ');
        let lines = [];
        let currentLine = "";

        for (let word of words) {
            if ((currentLine + word).length > 12) {
                lines.push(currentLine.trim());
                currentLine = word + " ";
            } else {
                currentLine += word + " ";
            }
        }
        lines.push(currentLine.trim());
        return lines;
    }

    spin() {
        if (this.state !== 'SPIN') return;
        this.wheelVelocity = 0.3 + (this.rng() * 0.2); // Random velocity
        this.jackpot += 100; // Grow jackpot
        this.state = 'SPINNING';
        this.message = "ROUND AND ROUND...";
    }

    update() {
        if (this.state === 'SPINNING') {
            this.wheelAngle += this.wheelVelocity;
            this.wheelVelocity *= 0.985; // Drag

            if (this.wheelVelocity < 0.002) {
                this.wheelVelocity = 0;
                this.resolveSpin();
            }
        }
    }

    resolveSpin() {
        const sectorSize = (Math.PI * 2) / WHEEL_SECTORS.length;
        let effectiveAngle = (this.wheelAngle + Math.PI / 2) % (Math.PI * 2);
        effectiveAngle = (Math.PI * 2) - effectiveAngle;
        const index = Math.floor(effectiveAngle / sectorSize) % WHEEL_SECTORS.length;
        this.currentSector = WHEEL_SECTORS[index];

        this.handleSectorResult(this.currentSector);
    }

    handleSectorResult(sector) {
        const player = this.getCurrentPlayer();

        if (sector.type === 'BANKRUPT') {
            // Check for shield? (Not implemented yet, maybe FREE SPIN saves? No, usually separate)
            player.roundCash = 0;
            this.message = "BANKRUPT!";
            this.state = 'RESULT';
            this.lastEffect = { type: 'SHAKE', amount: 20 };
            setTimeout(() => {
                this.nextPlayer();
            }, 1500);
            return { type: 'BANKRUPT' };

        } else if (sector.type === 'LOSE_TURN') {
            if (player.inventory.includes('FREE_SPIN')) {
                // Ask to use? For Arcade speed, let's auto-use or just burn it.
                // Let's burn it automatically to save turn.
                const idx = player.inventory.indexOf('FREE_SPIN');
                player.inventory.splice(idx, 1);
                this.message = "USED FREE SPIN!";
                this.state = 'SPIN'; // Spin again same player
                this.lastEffect = { type: 'PARTICLES', color: '#8bc34a' }; // Green save
                return { type: 'SAVED' };
            }
            this.message = "LOST A TURN!";
            this.state = 'RESULT';
             setTimeout(() => {
                 this.nextPlayer();
             }, 1500);
            return { type: 'LOSE_TURN' };

        } else if (sector.type === 'FREE_SPIN') {
             this.message = "FREE SPIN TOKEN!";
             player.inventory.push('FREE_SPIN');
             // Still need to guess a consonant usually, or spin again?
             // Standard rules: Pick up token, then guess consonant.
             // Let's simplify: You get the token and keep turn (Spin again).
             this.state = 'SPIN';
             this.lastEffect = { type: 'PARTICLES', color: '#8bc34a' };
             return { type: 'FREE' };

        } else if (sector.type === 'MYSTERY') {
             // 50/50 Chance
             const isGood = this.rng() > 0.5;
             if (isGood) {
                 this.message = "$10,000 MYSTERY! PICK CONSONANT";
                 sector.tempValue = 10000; // Hacky way to pass value
                 this.state = 'GUESS_CONSONANT';
                 this.lastEffect = { type: 'PARTICLES', color: '#ffd700' };
                 return { type: 'CASH', value: 10000 };
             } else {
                 player.roundCash = 0;
                 this.message = "MYSTERY BANKRUPT!";
                 this.state = 'RESULT';
                 this.lastEffect = { type: 'SHAKE', amount: 20 };
                 setTimeout(() => { this.nextPlayer(); }, 1500);
                 return { type: 'BANKRUPT' };
             }

        } else if (sector.type === 'JACKPOT') {
             this.message = `JACKPOT $${this.jackpot}! PICK CONSONANT`;
             // If they guess right, they get jackpot added to round cash?
             // Or they just get $500 per letter and chance to win jackpot on solve?
             // Arcade simplification: Treat as high value cash wedge for this turn equal to current Jackpot.
             sector.tempValue = this.jackpot;
             this.state = 'GUESS_CONSONANT';
             this.lastEffect = { type: 'PARTICLES', color: '#ffd700' };
             return { type: 'CASH', value: this.jackpot };

        } else {
            // CASH
            this.message = `$${sector.value} - PICK A CONSONANT`;
            this.state = 'GUESS_CONSONANT';
            return { type: 'CASH', value: sector.value };
        }
    }

    guessLetter(letter) {
        if (this.state !== 'GUESS_CONSONANT' && this.state !== 'BUY_ACTION') return;

        const player = this.getCurrentPlayer();

        if (this.guessedLetters.has(letter)) {
            this.message = "ALREADY GUESSED!";
            return false;
        }

        const isVowel = VOWELS.includes(letter);
        if (this.state === 'GUESS_CONSONANT' && isVowel) {
            this.message = "VOWELS MUST BE BOUGHT!";
            return false;
        }

        this.guessedLetters.add(letter);

        let count = 0;
        const text = this.puzzle.text;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === letter) {
                this.revealed[i] = true;
                count++;
            }
        }

        if (count > 0) {
            if (!isVowel) {
                // Determine value
                let val = 0;
                if (this.currentSector.type === 'MYSTERY') val = 10000; // Fixed 10k if good
                else if (this.currentSector.type === 'JACKPOT') val = this.jackpot;
                else val = this.currentSector.value || 0;

                player.roundCash += val * count;
                this.message = `FOUND ${count} ${letter}'s! SPIN, BUY, OR SOLVE.`;
                this.state = 'SPIN'; // Keep turn

                // Small particle burst for correct letter
                this.lastEffect = { type: 'PARTICLES', color: '#fff', count: 10 };
            } else {
                // Vowel bought (cost already deducted)
                this.message = `FOUND ${count} ${letter}'s!`;
                this.state = 'SPIN'; // Keep turn
                this.lastEffect = { type: 'PARTICLES', color: '#fff', count: 10 };
            }

            // Auto-solve check
            if (this.checkComplete()) {
                this.solveSuccess();
            }
            return true;
        } else {
            // Wrong guess
            this.message = `NO ${letter}!`;
            this.state = 'RESULT';
            setTimeout(() => {
                this.nextPlayer();
            }, 1000);
            return false;
        }
    }

    buyVowel() {
        const player = this.getCurrentPlayer();
        if (this.state !== 'SPIN') {
             this.message = "CAN ONLY BUY BEFORE SPINNING";
             return;
        }
        if (player.roundCash < VOWEL_COST) {
            this.message = "NEED $" + VOWEL_COST;
            return;
        }
        player.roundCash -= VOWEL_COST;
        this.state = 'BUY_ACTION';
        this.message = "PICK A VOWEL";
    }

    checkComplete() {
        return this.puzzle.text.split('').every((char, i) => this.revealed[i]);
    }

    solveAttempt(input) {
        if (input.toUpperCase() === this.puzzle.text) {
            this.solveSuccess();
            return true;
        } else {
            this.message = "WRONG ANSWER!";
            this.state = 'RESULT';
            this.lastEffect = { type: 'SHAKE', amount: 10 };
            setTimeout(() => {
                this.nextPlayer();
            }, 1000);
            return false;
        }
    }

    solveSuccess() {
        const player = this.getCurrentPlayer();
        player.bank += player.roundCash;
        // Minimum house limit? Usually $1000 minimum for solve
        if (player.roundCash < 1000) player.bank += (1000 - player.roundCash);

        this.currentPuzzleIndex++;
        this.state = 'ROUND_END';
        this.message = `${player.name} SOLVES IT!`;
        this.lastEffect = { type: 'PARTICLES', color: '#ffd700', count: 50 }; // BIG WIN

        setTimeout(() => {
            this.loadNextPuzzle();
        }, 3000);
    }
}
