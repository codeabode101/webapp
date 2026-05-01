import { beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env.GROQ_API_KEY = "test-api-key";
  vi.resetAllMocks();
});