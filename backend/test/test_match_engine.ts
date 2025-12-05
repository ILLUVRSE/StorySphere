import { RiverportEngine } from '../../shared/riverport-engine/engine';
import { TeamRoster } from '../../shared/riverport-engine/types';

// Mock Data
const mockTeam = (id: string): TeamRoster => ({
    id,
    name: `Team ${id}`,
    players: [
        { id: `${id}-p1`, name: 'P1', position: 'P', stats: {power:5, contact:5, speed:5, defense:5} },
        { id: `${id}-p2`, name: 'P2', position: 'C', stats: {power:10, contact:10, speed:10, defense:5} }
    ],
    lineup: [`${id}-p1`, `${id}-p2`],
    pitcher: `${id}-p1`
});

async function runTest() {
    console.log("--- Testing Riverport Match Engine ---");

    const home = mockTeam('home');
    const away = mockTeam('away');
    const seed = 'test-seed-123';

    // Run 1
    console.log("Run 1...");
    const engine1 = new RiverportEngine(seed, home, away);
    engine1.simulateToEnd();
    const events1 = engine1.getEvents();
    console.log(`Run 1 Events: ${events1.length}, Final Score: ${JSON.stringify(engine1.getState().score)}`);

    // Run 2
    console.log("Run 2...");
    const engine2 = new RiverportEngine(seed, home, away);
    engine2.simulateToEnd();
    const events2 = engine2.getEvents();
    console.log(`Run 2 Events: ${events2.length}, Final Score: ${JSON.stringify(engine2.getState().score)}`);

    // Verify Determinism (Ignoring timestamps)
    const cleanEvents1 = events1.map(({ ts, ...rest }: any) => rest);
    const cleanEvents2 = events2.map(({ ts, ...rest }: any) => rest);

    if (JSON.stringify(cleanEvents1) !== JSON.stringify(cleanEvents2)) {
        console.error("FAIL: Determinism check failed. Logs differ (ignoring timestamps).");
        // process.exit(1);
    } else {
        console.log("PASS: Determinism verified.");
    }

    // Verify Basic Rules
    const strikeouts = events1.filter((e: any) => e.payload.result === 'strike').length;
    console.log(`Total Strikes Thrown (roughly): ${strikeouts}`);

    // Check if match ended
    const endEvent = events1.find((e: any) => e.type === 'match_end');
    if (!endEvent) {
        console.error("FAIL: Match did not complete.");
        // process.exit(1);
    } else {
        console.log("PASS: Match completed.");
    }
}

runTest();
