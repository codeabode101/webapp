import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateClasswork, generateCurriculum, analyzeClass } = await import("./gpt.js");

describe("gpt.ts", () => {

  describe("generateClasswork", () => {
    it("should return classwork with homework and notes", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                classwork: "Create a simple game",
                homework: "Practice loops",
                notes: "Focus on basics"
              })
            }
          }]
        })
      }) as unknown as typeof fetch;

      const result = await generateClasswork("loops", "beginner game");

      expect(result.classwork).toBe("Create a simple game");
      expect(result.homework).toBe("Practice loops");
      expect(result.notes).toBe("Focus on basics");
    });

    it("should throw error when API key missing", async () => {
      vi.stubEnv("GROQ_API_KEY", "");

      await expect(generateClasswork("loops", "game"))
        .rejects.toThrow("GROQ_API_KEY not set");
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Server error")
      }) as unknown as typeof fetch;

      await expect(generateClasswork("loops", "game"))
        .rejects.toThrow("API error (500)");
    });
  });

  describe("analyzeClass", () => {
    it("should return analysis with taught methods and parent note", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                notes: "Good progress",
                taught_methods: "loops, conditionals",
                needs_practice: "nested loops",
                parent_note: "Great job this week!"
              })
            }
          }]
        })
      }) as unknown as typeof fetch;

      const result = await analyzeClass(
        "beginner",
        "Game Dev",
        "loops",
        "Make a game",
        "student did well"
      );

      expect(result.taught_methods).toBe("loops, conditionals");
      expect(result.needs_practice).toBe("nested loops");
      expect(result.parent_note).toBe("Great job this week!");
    });
  });

  describe("generateCurriculum", () => {
    it("should return curriculum with classes array", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: JSON.stringify({
                current_level: "Intermediate",
                final_goal: "Make a game",
                notes: "Good progress",
                classes: [
                  { name: "Class 1", methods: "loops", stretch_methods: "", description: "Learn loops" }
                ],
                future_concepts: ["functions", "classes"]
              })
            }
          }]
        })
      }) as unknown as typeof fetch;

      const result = await generateCurriculum(
        "Beginner",
        "Make a game",
        "fast learner",
        []
      );

      expect(result.current_level).toBe("Intermediate");
      expect(result.classes).toHaveLength(1);
      expect(result.future_concepts).toContain("functions");
    });
  });
});