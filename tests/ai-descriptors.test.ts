import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

type Descriptors = {
  source: string;
  criteria: { key: string; name: string }[];
  bands: Record<string, Record<string, string>>;
};

function load(name: string): Descriptors {
  return JSON.parse(readFileSync(`lib/ai-grading/descriptors/${name}.json`, "utf8"));
}

const WRITING_KEYS = ["taskAchievement", "coherence", "lexicalResource", "grammar"];
const SPEAKING_KEYS = ["fluency", "lexicalResource", "grammar", "pronunciation"];

describe("band descriptors dựng từ PDF", () => {
  it.each([
    ["writing-task1", WRITING_KEYS, "Task Achievement"],
    ["writing-task2", WRITING_KEYS, "Task Response"],
    ["speaking", SPEAKING_KEYS, "Fluency"]
  ] as const)("%s đủ band 0–9 và đủ 4 tiêu chí", (name, keys, firstName) => {
    const data = load(name);

    expect(data.criteria.map((c) => c.key)).toEqual(keys);
    expect(data.criteria[0].name).toContain(firstName);

    for (let band = 0; band <= 9; band += 1) {
      const row = data.bands[String(band)];
      expect(row, `band ${band}`).toBeDefined();
      for (const key of keys) {
        expect(row[key]?.trim().length ?? 0, `band ${band} · ${key}`).toBeGreaterThan(10);
      }
    }
  });

  it("chữ đã nối dòng, không còn xuống dòng lẻ giữa câu", () => {
    const data = load("writing-task2");
    // Band 7 Task Response là một đoạn dài: nếu chưa nối dòng sẽ có rất nhiều \n.
    const text = data.bands["7"].taskAchievement;
    const breaks = (text.match(/\n/g) ?? []).length;
    const bullets = (text.match(/\n[•▪●–-]/g) ?? []).length;
    expect(breaks).toBe(bullets);
  });
});
