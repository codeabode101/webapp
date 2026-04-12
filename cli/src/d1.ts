import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { Student, StudentClass } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WORKER_DIR = resolve(__dirname, "../../worker");

export type D1Mode = "remote" | "local";

let currentMode: D1Mode = "remote"; // remote = cloudflare d1 (webapp-db), local = wrangler.toml binding (codeabode - empty)

export function setD1Mode(mode: D1Mode): void {
  currentMode = mode;
}

export function getD1Mode(): D1Mode {
  return currentMode;
}

function cleanJsonOutput(stdout: string): string {
  // Find the start of the JSON array (D1 responses are arrays)
  const firstBracket = stdout.indexOf("[");
  if (firstBracket === -1) return "";

  let depth = 0;
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = firstBracket; i < stdout.length; i++) {
    const ch = stdout[i];
    
    if (escapeNext) {
      result += ch;
      escapeNext = false;
      continue;
    }
    
    if (ch === '\\' && inString) {
      result += ch;
      escapeNext = true;
      continue;
    }
    
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    
    if (!inString) {
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") depth--;
    }
    
    result += ch;
    if (depth === 0 && result.length > 1) break;
  }

  return result;
}

interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
  };
}

function runWrangler(sql: string): string {
  const args = [
    "-C",
    WORKER_DIR,
    "wrangler",
    "d1",
    "execute",
    "codeabode",
    "--command",
    sql,
  ];

  if (currentMode === "remote") {
    args.push("--remote");
  }

  const result = spawnSync("/usr/bin/npx", args, {
    encoding: "utf-8",
    timeout: 60000,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || "";
    const stdout = result.stdout?.toString() || "";
    throw new Error(`Status ${result.status}: ${stderr}\nStdout: ${stdout}`);
  }

  return result.stdout?.toString() || "";
}

export async function d1Query<T>(sql: string): Promise<T[]> {
  try {
    const stdout = runWrangler(sql);
    const jsonStr = cleanJsonOutput(stdout);
    const parsed = JSON.parse(jsonStr) as D1Result<T>[];

    const result = parsed[0];
    if (!result || !result.success) {
      throw new Error(`Query failed: ${stdout}`);
    }

    return result.results;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("NOT NULL constraint")) {
        throw new Error("NOT NULL constraint failed - missing required field");
      }
      if (error.message.includes("FOREIGN KEY constraint")) {
        throw new Error("Foreign key constraint failed - invalid reference");
      }
      throw error;
    }
    throw new Error(String(error));
  }
}

export async function d1Exec(sql: string): Promise<{ changes: number }> {
  try {
    const stdout = runWrangler(sql);
    const jsonStr = cleanJsonOutput(stdout);
    const parsed = JSON.parse(jsonStr) as D1Result<unknown>[];

    const result = parsed[0];
    if (!result || !result.success) {
      throw new Error(`Exec failed: ${stdout}`);
    }

    return { changes: result.meta.changes ?? 0 };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("NOT NULL constraint")) {
        throw new Error("NOT NULL constraint failed - missing required field");
      }
      if (error.message.includes("FOREIGN KEY constraint")) {
        throw new Error("Foreign key constraint failed - invalid reference");
      }
      if (error.message.includes("UNIQUE constraint")) {
        throw new Error("Unique constraint failed - value already exists");
      }
      throw error;
    }
    throw new Error(String(error));
  }
}

export async function deleteStudent(studentId: number): Promise<void> {
  await d1Exec(`DELETE FROM students_classes WHERE student_id = ${studentId}`);
  await d1Exec(`DELETE FROM students WHERE id = ${studentId}`);
}

export async function listStudents(): Promise<Student[]> {
  return d1Query<Student>("SELECT id, name FROM students ORDER BY name");
}

export async function getStudent(id: number): Promise<Student | null> {
  const results = await d1Query<Student>(
    `SELECT id, name, age, current_level, final_goal, future_concepts, notes, current_class, step FROM students WHERE id = ${id}`
  );
  if (!results[0]) return null;
  
  return {
    ...results[0],
    step: results[0].step || 1,
  };
}

export async function getStudentClasses(studentId: number): Promise<StudentClass[]> {
  return d1Query<StudentClass>(
    `SELECT class_id, student_id, status, name, class_type, class_date, accomplished, methods, stretch_methods, description, classwork, notes, hw, hw_notes, taught_methods, needs_practice
     FROM students_classes WHERE student_id = ${studentId} ORDER BY class_id DESC`
  );
}

export async function createStudent(
  name: string,
  age: number,
  level: string,
  goal: string
): Promise<number> {
  const escapedName = name.replace(/'/g, "''");
  const escapedLevel = level.replace(/'/g, "''");
  const escapedGoal = goal.replace(/'/g, "''");

  await d1Exec(
    `INSERT INTO students (name, age, current_level, final_goal, future_concepts, step) VALUES ('${escapedName}', ${age}, '${escapedLevel}', '${escapedGoal}', '[]', 1)`
  );

  const results = await d1Query<{ id: number }>("SELECT id FROM students ORDER BY rowid DESC LIMIT 1");
  return results[0].id;
}

export async function updateStudentInfo(
  id: number,
  data: {
    current_level?: string;
    final_goal?: string;
    future_concepts?: string;
    notes?: string;
    current_class?: number;
    step?: number;
  }
): Promise<void> {
  const sets: string[] = [];
  
  if (data.current_level !== undefined) {
    sets.push(`current_level = '${data.current_level.replace(/'/g, "''")}'`);
  }
  if (data.final_goal !== undefined) {
    sets.push(`final_goal = '${data.final_goal.replace(/'/g, "''")}'`);
  }
  if (data.future_concepts !== undefined) {
    sets.push(`future_concepts = '${data.future_concepts.replace(/'/g, "''")}'`);
  }
  if (data.notes !== undefined) {
    sets.push(`notes = '${data.notes.replace(/'/g, "''")}'`);
  }
  if (data.current_class !== undefined) {
    sets.push(`current_class = ${data.current_class}`);
  }
  if (data.step !== undefined) {
    sets.push(`step = ${data.step}`);
  }
  
  if (sets.length === 0) return;
  
  await d1Exec(`UPDATE students SET ${sets.join(", ")} WHERE id = ${id}`);
}

export async function createClass(
  studentId: number,
  name: string,
  classType: string,
  classDate: string,
  methods: string,
  stretchMethods: string,
  description: string,
  status: string = "current"
): Promise<number> {
  const escapedName = name ? `'${name.replace(/'/g, "''")}'` : "''";
  const escapedDesc = description ? `'${description.replace(/'/g, "''")}'` : "''";
  const escapedMethods = methods ? `'${methods.replace(/'/g, "''")}'` : "''";
  const escapedStretch = stretchMethods ? `'${stretchMethods.replace(/'/g, "''")}'` : "''";

  const typeVal = classType ? `'${classType.replace(/'/g, "''")}'` : "''";
  const dateVal = classDate ? `'${classDate}'` : "''";

  await d1Exec(
    `INSERT INTO students_classes (student_id, status, name, class_type, class_date, methods, stretch_methods, description) VALUES (${studentId}, '${status}', ${escapedName}, ${typeVal}, ${dateVal}, ${escapedMethods}, ${escapedStretch}, ${escapedDesc})`
  );

  const results = await d1Query<{ class_id: number }>("SELECT class_id FROM students_classes ORDER BY rowid DESC LIMIT 1");
  return results[0].class_id;
}

export async function updateClasswork(
  classId: number,
  classwork: string,
  notes: string
): Promise<void> {
  const escapedCw = classwork.replace(/'/g, "''");
  const escapedNotes = notes.replace(/'/g, "''");

  await d1Exec(
    `UPDATE students_classes SET classwork = '${escapedCw}', notes = '${escapedNotes}', status = 'completed' WHERE class_id = ${classId}`
  );
}

export async function updateGeneratedClasswork(
  classId: number,
  classwork: string,
  homework: string,
  notes: string
): Promise<void> {
  const escapedCw = classwork.replace(/'/g, "''");
  const escapedHw = homework.replace(/'/g, "''");
  const escapedNotes = notes.replace(/'/g, "''");

  await d1Exec(
    `UPDATE students_classes SET classwork = '${escapedCw}', hw = '${escapedHw}', notes = '${escapedNotes}' WHERE class_id = ${classId}`
  );
}

export async function updateClass(
  classId: number,
  data: {
    name?: string;
    class_type?: string;
    class_date?: string;
    accomplished?: string;
    methods?: string;
    stretch_methods?: string;
    description?: string;
    classwork?: string;
    notes?: string;
    hw?: string;
    hw_notes?: string;
    status?: string;
    taught_methods?: string;
    needs_practice?: string;
  }
): Promise<void> {
  const sets: string[] = [];
  const values: string[] = [];

  if (data.name !== undefined) {
    sets.push(`name = '${data.name.replace(/'/g, "''")}'`);
  }
  if (data.class_type !== undefined) {
    sets.push(`class_type = '${data.class_type}'`);
  }
  if (data.class_date !== undefined) {
    sets.push(`class_date = '${data.class_date}'`);
  }
  if (data.accomplished !== undefined) {
    sets.push(`accomplished = '${data.accomplished}'`);
  }
  if (data.methods !== undefined) {
    sets.push(`methods = '${data.methods}'`);
  }
  if (data.stretch_methods !== undefined) {
    sets.push(`stretch_methods = '${data.stretch_methods}'`);
  }
  if (data.description !== undefined) {
    sets.push(`description = '${data.description.replace(/'/g, "''")}'`);
  }
  if (data.classwork !== undefined) {
    sets.push(`classwork = '${data.classwork.replace(/'/g, "''")}'`);
  }
  if (data.notes !== undefined) {
    sets.push(`notes = '${data.notes.replace(/'/g, "''")}'`);
  }
  if (data.hw !== undefined) {
    sets.push(`hw = '${data.hw.replace(/'/g, "''")}'`);
  }
  if (data.hw_notes !== undefined) {
    sets.push(`hw_notes = '${data.hw_notes.replace(/'/g, "''")}'`);
  }
  if (data.status !== undefined) {
    sets.push(`status = '${data.status}'`);
  }
  if (data.taught_methods !== undefined) {
    sets.push(`taught_methods = '${data.taught_methods.replace(/'/g, "''")}'`);
  }
  if (data.needs_practice !== undefined) {
    sets.push(`needs_practice = '${data.needs_practice.replace(/'/g, "''")}'`);
  }

  if (sets.length === 0) return;

  await d1Exec(`UPDATE students_classes SET ${sets.join(", ")} WHERE class_id = ${classId}`);
}

export interface Account {
  id: number;
  name: string;
  email: string | null;
}

export async function getAccountsForStudent(studentId: number): Promise<Account[]> {
  const student = await d1Query<{ account_id: string | null }>(
    `SELECT account_id FROM students WHERE id = ${studentId}`
  );

  if (!student[0]?.account_id) return [];

  // account_id is stored as JSON array like "{1,3}"
  const raw = student[0].account_id.replace(/[{}]/g, "");
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  const accounts: Account[] = [];
  for (const id of ids) {
    const results = await d1Query<Account>(
      `SELECT id, name, email FROM accounts WHERE id = ${id}`
    );
    accounts.push(...results);
  }

  return accounts;
}