
import { MatchManager } from '../src/matches/MatchManager';
// Mock server for IO
const mockIo = { to: () => ({ emit: () => {} }) } as any;

async function testDeterminism() {
    console.log("Running Determinism Test...");
    const manager = new MatchManager(mockIo);

    // We don't start the loop because we want to manually simulate

    // 1. Create a match with fixed seed
    const seed = "test-seed-123";
    const id1 = await manager.createMatch(undefined, seed);

    // 2. Simulate to completion
    console.log(`Simulating match 1 (${id1})...`);
    const log1 = manager.simulateMatchToCompletion(id1);

    // 3. Create another match with SAME seed
    const id2 = await manager.createMatch(undefined, seed);

    // 4. Simulate to completion
    console.log(`Simulating match 2 (${id2})...`);
    const log2 = manager.simulateMatchToCompletion(id2);

    // 5. Compare logs
    const json1 = JSON.stringify(log1);
    const json2 = JSON.stringify(log2);

    if (json1 === json2) {
        console.log("✅ Determinism Verified: Logs are identical.");
        console.log(`Event Log Length: ${log1?.length}`);
    } else {
        console.error("❌ Determinism Failed: Logs differ.");
        console.log("Log 1 Sample:", json1.substring(0, 200));
        console.log("Log 2 Sample:", json2.substring(0, 200));
    }

    process.exit(0);
}

testDeterminism().catch(console.error);
