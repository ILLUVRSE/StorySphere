import { buildSchedule, getLivePointer, getMostRecentThreePm } from "../lib/scheduler";

const episodes = [
  { productionId: 1, season: 1, episode: 1, title: "Ep1", filename: "1.mp4", url: "/1.mp4", durationSeconds: 300 },
  { productionId: 2, season: 1, episode: 2, title: "Ep2", filename: "2.mp4", url: "/2.mp4", durationSeconds: 300 },
  { productionId: 3, season: 1, episode: 3, title: "Ep3", filename: "3.mp4", url: "/3.mp4", durationSeconds: 600 },
];

describe("scheduler", () => {
  test("buildSchedule produces contiguous slots over horizon", () => {
    const now = 0;
    const horizonMs = 30 * 60 * 1000; // 30 minutes
    const schedule = buildSchedule(episodes, now, horizonMs, 0);
    expect(schedule.length).toBeGreaterThan(0);
    for (let i = 0; i < schedule.length - 1; i++) {
      expect(schedule[i].end).toBe(schedule[i + 1].start);
    }
  });

  test("getLivePointer returns correct index and offset within loop", () => {
    const pointer1 = getLivePointer(episodes, 500_000, 0); // 8m20s from anchor 0
    expect(pointer1).toEqual({ index: 1, offsetSeconds: 200 });

    const pointerWrap = getLivePointer(episodes, 1_300_000, 0); // wraps past total 1200s
    expect(pointerWrap).toEqual({ index: 0, offsetSeconds: 100 });
  });

  test("fixed time anchor aligns to most recent 15:00", () => {
    const now = new Date();
    now.setHours(16, 0, 0, 0);
    const anchor = getMostRecentThreePm(now.getTime());
    const pointer = getLivePointer(episodes, now.getTime(), anchor);
    expect(pointer?.index).toBe(0);
    expect(pointer?.offsetSeconds).toBe(0);
  });
});
