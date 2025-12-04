
import { GameEngine } from './src/engine';

// Simple manual test script for the engine
console.log("Running Engine Tests...");

const engine = new GameEngine(12345); // Seeded

// 1. Initial State
console.assert(engine.state.phase === 'PITCHING', "Initial phase should be PITCHING");
console.assert(engine.state.inning === 1, "Initial inning should be 1");
console.assert(engine.state.score.home === 0, "Initial score should be 0");

// 2. Pitch Sequence
console.log("Testing Pitch...");
engine.applyInput({ clientId: 'p1', seq: 1, ts: 1, action: { type: 'START_PITCH' } });
console.assert(engine.state.pitchMeter.active === true, "Pitch meter should be active");

// Simulate ticks for meter charge
for(let i=0; i<10; i++) engine.tick();
console.assert(engine.state.pitchMeter.value > 0, "Pitch meter value should increase");

engine.applyInput({ clientId: 'p1', seq: 2, ts: 2, action: { type: 'PITCH_PHASE_2' } });
console.assert(engine.state.pitchMeter.phase === 2, "Pitch meter should be in phase 2");

engine.applyInput({ clientId: 'p1', seq: 3, ts: 3, action: { type: 'THROW_PITCH' } });
console.assert(engine.state.pitchMeter.active === false, "Pitch meter should be inactive after throw");
console.assert(engine.state.ball.state === 'pitched', "Ball state should be 'pitched'");

// 3. Tick ball forward
console.log("Simulating ball flight...");
let crossedPlate = false;
for(let i=0; i<100; i++) {
    engine.tick();
    if (engine.state.ball.y > 510 && engine.state.ball.state === 'idle') {
        crossedPlate = true;
        break;
    }
}
console.assert(crossedPlate, "Ball should eventually cross plate and reset to idle");

console.log("Engine Tests Passed!");
