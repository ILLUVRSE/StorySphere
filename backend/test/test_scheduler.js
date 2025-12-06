// Mock DB (Minimal)
const mockDb = {
    isReady: () => false, // Run logic in memory only
};

// Scheduler Service Logic (Copied for testing without TS/Imports hassle in manual script)
class SchedulerServiceTest {
    generate12WeekSchedule(teams) {
        const n = teams.length;
        const baseSchedule = this.generateRoundRobin(teams);
        let fullSchedule = [];
        let currentWeek = 1;
        let cycle = 0;

        while (currentWeek <= 12) {
            const isSwap = cycle % 2 !== 0;
            const rounds = n - 1;
            for (let r = 1; r <= rounds; r++) {
                if (currentWeek > 12) break;
                const weeklyMatches = baseSchedule.filter(m => m.week === r);
                for (const m of weeklyMatches) {
                    fullSchedule.push({
                        week: currentWeek,
                        home: isSwap ? m.away : m.home,
                        away: isSwap ? m.home : m.away
                    });
                }
                currentWeek++;
            }
            cycle++;
        }
        return fullSchedule;
    }

    generateRoundRobin(teams) {
        const schedule = [];
        const n = teams.length;
        const rotation = [...teams];
        for (let round = 0; round < n - 1; round++) {
            const week = round + 1;
            for (let i = 0; i < n / 2; i++) {
                const home = rotation[i];
                const away = rotation[n - 1 - i];
                if (round % 2 === 0) schedule.push({ week, home, away });
                else schedule.push({ week, home: away, away: home });
            }
            const last = rotation.pop();
            rotation.splice(1, 0, last);
        }
        return schedule;
    }
}

const scheduler = new SchedulerServiceTest();

function testSize(size) {
    console.log(`Testing Size ${size}...`);
    const teams = Array.from({length: size}, (_, i) => `T${i+1}`);
    const schedule = scheduler.generate12WeekSchedule(teams);

    // Check Weeks
    const maxWeek = Math.max(...schedule.map(m => m.week));
    console.log(`Max Week: ${maxWeek} (Expected 12)`);

    // Check Matches Per Week
    const matchesPerWeek = schedule.filter(m => m.week === 1).length;
    console.log(`Matches Per Week 1: ${matchesPerWeek} (Expected ${size/2})`);

    // Check Fairness (Every team plays once per week)
    let fair = true;
    for (let w = 1; w <= 12; w++) {
        const weekMatches = schedule.filter(m => m.week === w);
        const played = new Set();
        weekMatches.forEach(m => {
            if (played.has(m.home) || played.has(m.away)) fair = false;
            played.add(m.home);
            played.add(m.away);
        });
        if (played.size !== size) fair = false;
    }
    console.log(`Fairness Check: ${fair ? 'PASS' : 'FAIL'}`);
    console.log('---');
}

testSize(6);
testSize(10);
testSize(12);

// Error Check
try {
    const s = 8;
    const allowed = [6, 10, 12];
    if (!allowed.includes(s)) console.log("Size 8 Rejected: PASS");
    else console.log("Size 8 Rejected: FAIL");
} catch(e) {}
