import { SchedulerService } from '../src/services/scheduler';

async function testScheduler() {
    console.log("Testing Scheduler Round Robin...");
    const scheduler = new SchedulerService();

    const teams = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']; // 6 Teams

    // @ts-ignore - Accessing private method via public wrapper logic in createSeason
    // Actually createSeason calls db, so we want to test generateRoundRobin directly if possible.
    // Since it's private, we can't easily.
    // I'll make it public for test or just rely on creating a season logic but fail on DB.
    // Actually, typescript private is soft.

    // @ts-ignore
    const schedule = scheduler.generateRoundRobin(teams);

    console.log(`Generated ${schedule.length} matches for ${teams.length} teams.`);

    // Expect (N-1) rounds * (N/2) matches/round
    // 5 * 3 = 15 matches.

    if (schedule.length === 15) {
        console.log("✅ Match count correct (15).");
    } else {
         console.error(`❌ Match count incorrect: ${schedule.length}`);
    }

    // Check fairness - each team plays every other team exactly once?
    // Actually this RR implementation creates weekly slots.
    // Check if T1 plays 5 times.
    const t1Matches = schedule.filter((m: any) => m.home === 'T1' || m.away === 'T1');
    if (t1Matches.length === 5) {
         console.log("✅ T1 plays 5 games (Correct for single round robin).");
    } else {
         console.error(`❌ T1 match count incorrect: ${t1Matches.length}`);
    }
}

testScheduler();
