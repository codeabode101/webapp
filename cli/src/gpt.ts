import { env } from "node:process";
import {
  ChatRequest,
  ChatMessage,
  ChatResponse,
  GeneratedClasswork,
  StudentClass,
} from "./types.js";

const API_URL = "https://ai.hackclub.com/proxy/v1/chat/completions";
const MODEL = "claude-sonnet-4-20250514";

const CLASSNOTES_PROMPT = `You are a coding classwork generator. Create a step-by-step guide for students.
- Be concise and kid-friendly
- Use bullets, not paragraphs
- Include tiny code snippets (1-2 lines)
- Focus on what students should BUILD

Output format:
{
  "classwork": "step-by-step guide with code snippets",
  "homework": "optional homework task",
  "notes": "teaching tips for instructor"
}`;

const ASSESSMENT_PROMPT = `You are an assessment generator. Create in-class assessments.
- 70% should be directly achievable using taught methods
- Clear step-by-step instructions
- Project-connected relevance

Output format:
{
  "classwork": "assessment with warm-up and build tasks",
  "homework": "extra credit if applicable",
  "notes": "teacher tips"
}`;

const CLASSANALYSIS_PROMPT = `You are an educational assistant that helps teachers document student progress.

Analyze teacher's notes and output:
{
  "taught_methods": "specific methods student mastered",
  "needs_practice": "areas needing more practice",
  "notes": "parent-friendly feedback"
}`;

const HWGPT_PROMPT = `You are a homework generator. Create 5-day coding projects.
- PG-13 themes only
- Prioritize practical simulations over game themes
- Progressive: Day 1 concrete → Day 3 guided creativity → Day 5 open-ended

Output:
{
  "hw": "5-day homework assignment",
  "notes": "teacher notes"
}`;

const CREATIVE_HWGPT_PROMPT = `You are a creative homework designer. Make fun assignments.
- Include "spark creativity" suggestions
- Age-appropriate language
- Open-ended exploration

Output:
{
  "hw": "creative homework assignment",
  "notes": "teacher notes"
}`;

export async function generateClasswork(
  methods: string,
  description: string,
  promptType: "classnotes" | "assessment" | "generate" = "classnotes",
  age?: number,
  level?: string,
  notes?: string
): Promise<GeneratedClasswork> {
  const apiKey = env.HACKCLUB_API_KEY;
  if (!apiKey) {
    throw new Error("HACKCLUB_API_KEY not set in environment");
  }

  const prompt = `You are a coding tutor. Generate a classwork assignment and homework for a student learning to code.

## Student Context
- **Methods to practice**: ${methods || "none specified"}
- **Topic/Description**: ${description || "general coding"}

## Instructions
Generate a coding classwork assignment and homework assignment that:
1. Is appropriate for the student's level
2. Reinforces the methods being learned
3. Is specific and actionable (not vague)

## Output Format
Return ONLY a valid JSON object (no other text). Use this exact structure:
{
  "classwork": "1-2 sentence assignment that teaches the concept",
  "homework": "1-2 sentence homework that reinforces learning",
  "notes": "brief teaching tips for the instructor (1-2 sentences)"
}`;

  const request: ChatRequest = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_object",
    },
  };

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(`Network error: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    throw new Error(`API error (${status}): ${body}`);
  }

  let chatResponse: ChatResponse;
  try {
    chatResponse = await response.json() as ChatResponse;
  } catch (error) {
    throw new Error(`Invalid API response: ${error instanceof Error ? error.message : String(error)}`);
  }

  const content = chatResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from API");
  }

  let parsed: GeneratedClasswork;
  try {
    parsed = JSON.parse(content) as GeneratedClasswork;
  } catch {
    throw new Error(`Invalid JSON in response: ${content}`);
  }

  if (!parsed.classwork || !parsed.homework) {
    throw new Error(`Incomplete response: ${content}`);
  }

  return {
    classwork: parsed.classwork,
    homework: parsed.homework,
    notes: parsed.notes || "",
  };
}

export interface Curriculum {
  current_level: string;
  final_goal: string;
  notes: string;
  classes: Array<{
    name: string;
    methods: string;
    stretch_methods: string;
    description: string;
  }>;
  future_concepts: string[];
}

export async function generateCurriculum(
  currentLevel: string,
  finalGoal: string,
  notes: string,
  classes: StudentClass[]
): Promise<Curriculum> {
  const apiKey = env.HACKCLUB_API_KEY;
  if (!apiKey) {
    throw new Error("HACKCLUB_API_KEY not set in environment");
  }

  const systemPrompt = `### Curriculum Agent System Prompt  
**Role**: You are an expert 1:1 coding curriculum generator. Your job is to create hyper-personalized lesson plans that adapt to student progress while relentlessly connecting concepts to their unique final project goal.

### Core Rules
1. **Exhaustive Path Building**
   - Maintain future_concepts as a complete ordered list from current level to final goal
   - Never omit foundational steps
2. **Atomic Concept Splitting**
   - Split future_concepts into teachable atomic units
3. **Assessment Triggers**
   - Insert project class when 1-2 concepts form minimum viable project

### Output Format
Return ONLY valid JSON:
{
  "current_level": "string",
  "final_goal": "string", 
  "notes": "string",
  "classes": [{"name": "string", "methods": "string", "stretch_methods": "string", "description": "string"}],
  "future_concepts": ["string"]
}`;

  let classHistory = "";
  for (const c of classes) {
    classHistory += `\nClass: ${c.name}\nMethods: ${c.methods}\nDescription: ${c.description}\n`;
  }

  const userMessage = `
Age: (ask if needed)
Current Level: ${currentLevel}
Final Goal: ${finalGoal}
Notes: ${notes}

Class History:
${classHistory}
`;

  const request: ChatRequest = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const chatResponse = (await response.json()) as ChatResponse;
  const content = chatResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from API");
  }

  return JSON.parse(content) as Curriculum;
}

export interface CompletedClass {
  notes: string;
  taught_methods: string;
  needs_practice: string;
}

export async function analyzeClass(
  currentLevel: string,
  description: string,
  methods: string,
  classwork: string,
  teacherNotes: string
): Promise<CompletedClass> {
  const apiKey = env.HACKCLUB_API_KEY;
  if (!apiKey) {
    throw new Error("HACKCLUB_API_KEY not set in environment");
  }

  const systemPrompt = `## Class Analysis
Analyze the class and output what was actually taught:
{
  "notes": "teaching tips",
  "taught_methods": "comma-separated methods actually taught",
  "needs_practice": "concepts needing practice"
}`;

  const userMessage = `
Student Level: ${currentLevel}
Class: ${description}
Methods (planned): ${methods}
Classwork: ${classwork}
Teacher notes: ${teacherNotes}
`;

  const request: ChatRequest = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const chatResponse = (await response.json()) as ChatResponse;
  const content = chatResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from API");
  }

  return JSON.parse(content) as CompletedClass;
}

export async function generateHomework(
  currentLevel: string,
  description: string,
  methods: string,
  classwork: string,
  taughtMethods: string,
  needsPractice: string
): Promise<{ hw: string; notes: string }> {
  const apiKey = env.HACKCLUB_API_KEY;
  if (!apiKey) {
    throw new Error("HACKCLUB_API_KEY not set in environment");
  }

  const systemPrompt = `## Homework Generator
Generate homework based on what was taught:
{
  "hw": "homework assignment",
  "notes": "teaching tips"
}`;

  const userMessage = `
Student Level: ${currentLevel}
Class: ${description}
Methods (planned): ${methods}
What was actually taught: ${taughtMethods}
Needs practice: ${needsPractice}
Classwork: ${classwork}
`;

  const request: ChatRequest = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const chatResponse = (await response.json()) as ChatResponse;
  const content = chatResponse.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from API");
  }

  return JSON.parse(content);
}