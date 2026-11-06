import { afterEach, expect, it, vi } from "vitest";
import { scheduleRpcRead } from "../../sdk/index";

afterEach(() => vi.useRealTimers());

it("spaces public reads, bounds simultaneous requests and recovers after a rejected read", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const started: number[] = [];
  const finishes: (() => void)[] = [];
  let active = 0;
  let maximum = 0;
  const endpoint = "https://read-budget.example/";
  const tasks = Array.from({ length: 4 }, (_, index) =>
    scheduleRpcRead(endpoint, () => {
      started.push(Date.now());
      maximum = Math.max(maximum, ++active);
      return new Promise<void>((resolve, reject) => {
        finishes[index] = () => {
          active--;
          if (index === 0) reject(new Error("temporary RPC failure"));
          else resolve();
        };
      });
    }),
  );
  const settled = Promise.allSettled(tasks);
  await vi.advanceTimersByTimeAsync(900);
  expect(started).toEqual([0, 300, 600]);
  expect(maximum).toBe(3);
  finishes[0]();
  await vi.advanceTimersByTimeAsync(0);
  expect(started).toEqual([0, 300, 600, 900]);
  for (const finish of finishes.slice(1)) finish();
  expect((await settled).map((r) => r.status)).toEqual([
    "rejected",
    "fulfilled",
    "fulfilled",
    "fulfilled",
  ]);
  const next = scheduleRpcRead(endpoint, async () => "still works");
  await vi.advanceTimersByTimeAsync(300);
  expect(await next).toBe("still works");
});
