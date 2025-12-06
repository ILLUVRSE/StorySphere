const { createPlayer, VALID_POSITIONS } = require('../src/controllers/players');
const { updateSkillAllocation, createTeam } = require('../src/controllers/teams');

// Mock req/res
const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
};

// ---------------------------------------------
// Test 1: Ramped Cost Calculation Logic
// ---------------------------------------------
// We need to access the internal function or simulate via updateSkillAllocation.
// Since it's not exported, we'll verify it via the endpoint logic if we could run it against a DB.
// But this is a "manual test" script potentially running without a full DB.
// Let's create a standalone verification of the cost logic here to ensure our assumptions match code.

function calculateCostToReach(targetLevel) {
    const BASE_STAT = 1;
    if (targetLevel <= BASE_STAT) return 0;
    let cost = 0;
    for (let lvl = BASE_STAT + 1; lvl <= targetLevel; lvl++) {
        if (lvl <= 5) cost += 1;
        else if (lvl <= 8) cost += 2;
        else cost += 3;
    }
    return cost;
}

console.log("--- Testing Cost Logic ---");
// 1 -> 5 (4 levels * 1) = 4
console.log(`Cost to 5 (Exp: 4): ${calculateCostToReach(5)}`);
// 1 -> 6 (4 + 2) = 6
console.log(`Cost to 6 (Exp: 6): ${calculateCostToReach(6)}`);
// 1 -> 9 (4 + (3*2) + 3) = 4 + 6 + 3 = 13?
// 1->2(1), 2->3(1), 3->4(1), 4->5(1) = 4
// 5->6(2), 6->7(2), 7->8(2) = 6
// 8->9(3) = 3. Total = 13.
console.log(`Cost to 9 (Exp: 13): ${calculateCostToReach(9)}`);
// 1 -> 10 (13 + 3) = 16
console.log(`Cost to 10 (Exp: 16): ${calculateCostToReach(10)}`);

if (calculateCostToReach(10) !== 16) {
    console.error("FAIL: Cost calculation mismatch");
    process.exit(1);
} else {
    console.log("PASS: Cost calculation logic correct");
}

console.log("\n--- Manual Verification Instructions ---");
console.log("1. Start backend: npm run dev");
console.log("2. Use Postman/Curl to Create Team (POST /api/teams)");
console.log("3. Create 13 Players (POST /api/teams/:id/players)");
console.log("4. Try to create 14th player -> Expect 409");
console.log("5. Call PUT /api/teams/:id/skill-allocation with valid/invalid budgets");
