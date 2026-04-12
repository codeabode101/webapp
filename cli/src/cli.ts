import inquirer from "inquirer";
import ora from "ora";
import {
  listStudents,
  getStudent,
  getStudentClasses,
  createStudent,
  createClass,
  updateClasswork,
  updateGeneratedClasswork,
  deleteStudent,
  setD1Mode,
  getD1Mode,
  updateStudentInfo,
  updateClass,
  d1Exec,
  getAccountsForStudent,
} from "./d1.js";
import {
  generateClasswork as genClasswork,
  generateCurriculum,
  analyzeClass,
  generateHomework,
} from "./gpt.js";
import { sendHomeworkEmail, EmailContext } from "./email.js";
import { Student, StudentClass, CliAction, ClassAction } from "./types.js";

const generateClasswork = genClasswork;

const ORANGE = "\x1b[38;2;255;165;0m";

function printHeader(text: string): void {
  console.log(`\n${ORANGE}=== ${text} ===\x1b[0m\n`);
}

function printSuccess(text: string): void {
  console.log(`\n✅ ${text}\n`);
}

function printError(text: string): void {
  console.log(`\n❌ ${text}\n`);
}

export async function runList(): Promise<void> {
  const spinner = ora("Loading students...").start();

  try {
    const students = await listStudents();
    spinner.stop();

    if (students.length === 0) {
      console.log("No students found.");
      return;
    }

    printHeader("Students");
    for (const student of students) {
      console.log(`  ${student.id}: ${student.name}`);
    }
    console.log(`\nTotal: ${students.length} students\n`);
  } catch (error) {
    spinner.fail("Failed to load students");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function runDelete(): Promise<void> {
  const spinner = ora("Loading students...").start();

  let students: Student[];
  try {
    students = await listStudents();
    spinner.stop();
  } catch (error) {
    spinner.fail("Failed to load students");
    printError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  if (students.length === 0) {
    console.log("No students found.");
    return;
  }

  const { studentId } = await inquirer.prompt({
    type: "list",
    name: "studentId",
    message: "Select a student to delete:",
    choices: [
      ...students.map((s) => ({
        name: `${s.name} (${s.id})`,
        value: s.id,
      })),
      { name: "Cancel", value: -1 },
    ],
    loop: false,
  });

  if (studentId === -1) {
    console.log("Cancelled.");
    return;
  }

  const student = students.find((s) => s.id === studentId);
  const { confirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to delete "${student?.name}"? This will also delete all their classes.`,
    default: false,
  });

  if (!confirm) {
    console.log("Cancelled.");
    return;
  }

  const deleteSpinner = ora("Deleting...").start();
  try {
    await deleteStudent(studentId);
    deleteSpinner.succeed("Deleted!");
    printSuccess(`Student "${student?.name}" deleted`);
  } catch (error) {
    deleteSpinner.fail("Failed to delete");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function runContinue(): Promise<void> {
  const spinner = ora("Loading students...").start();

  let students: Student[];
  try {
    students = await listStudents();
    spinner.stop();
  } catch (error) {
    spinner.fail("Failed to load students");
    printError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  if (students.length === 0) {
    console.log("No students found. Create one first with 'new'.");
    return;
  }

  const { studentId } = await inquirer.prompt({
    type: "list",
    name: "studentId",
    message: "Select a student:",
    choices: students.map((s) => ({
      name: s.name,
      value: s.id,
    })),
    loop: false,
  });

  const studentSpinner = ora("Loading student...").start();

  let student: Student | null;
  let classes: StudentClass[];
  try {
    student = await getStudent(studentId);
    if (!student) {
      studentSpinner.fail("Student not found");
      return;
    }
    classes = await getStudentClasses(studentId);
    studentSpinner.stop();
  } catch (error) {
    studentSpinner.fail("Failed to load student");
    printError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  printHeader(student.name);
  console.log(`Step: ${student.step || 1}`);
  console.log(`Level: ${student.current_level || "N/A"}`);
  console.log();

  const current = classes.find((c) => c.status === "current");
  const completed = classes.filter((c) => c.status === "completed");
  const upcoming = classes.filter((c) => c.status === "upcoming");

  console.log(`Completed (${completed.length}):`);
  for (const c of completed.slice(0, 3)) {
    console.log(`  - ${c.name}`);
  }
  if (completed.length > 3) {
    console.log(`  ... and ${completed.length - 3} more`);
  }
  console.log();

  const step = student.step || 1;

  // For step=2, we need the class we just worked on (most recent completed or set current_class)
  let workingClass = current;
  if (step === 2 && !workingClass && student.current_class) {
    workingClass = classes.find(c => c.class_id === student.current_class);
  }
  if (step === 2 && !workingClass && completed.length > 0) {
    workingClass = completed[0]; // most recent completed
  }

  // If step=1 and no current → need to plan (generate first class)
  if (step === 1 && !current && upcoming.length > 0) {
    await updateStudentInfo(studentId, { current_class: upcoming[0].class_id });
    await updateClass(upcoming[0].class_id, { status: "current" });
    await handleStep1(studentId, student, upcoming[0], classes);
  } else if (step === 1 && current) {
    console.log(`Current: ${current.name}`);
    await handleStep1(studentId, student, current, classes);
  } else if (step === 2 && workingClass) {
    console.log(`Working on: ${workingClass.name}`);
    await handleStep2(studentId, student, workingClass, classes);
  } else if (step === 2 && upcoming.length > 0) {
    // No current but has upcoming - move to current first
    console.log(`Upcoming: ${upcoming[0].name}`);
    await updateStudentInfo(studentId, { current_class: upcoming[0].class_id });
    await updateClass(upcoming[0].class_id, { status: "current" });
    await handleStep1(studentId, student, upcoming[0], classes);
  } else {
    console.log("No class. Planning...");
    console.log("No class. Planning...");
    await handleStep1(studentId, student, { class_id: 0, student_id: studentId, status: "current", name: "" } as StudentClass, classes);
  }
}

async function handleStep1(
  studentId: number,
  student: Student,
  currentClass: StudentClass,
  allClasses: StudentClass[]
): Promise<void> {
  console.log("\n--- Step 1: After class - generate classwork ---");
  console.log(`Class: ${currentClass.name}`);
  if (currentClass.description) {
    console.log(`Description: ${currentClass.description}`);
  }

  const { classworkType } = await inquirer.prompt({
    type: "list",
    name: "classworkType",
    message: "Generate classwork:",
    choices: [
      { name: "(A)ssessment", value: "assessment" },
      { name: "10-(m)in warmup", value: "warmup" },
      { name: "(u)pload", value: "upload" },
      { name: "(g)enerate", value: "generate" },
      { name: "(n)one", value: "none" },
    ],
    default: "generate",
  });

  let classworkText = "";

  if (classworkType === "none") {
    console.log("No classwork this time.");
  } else if (classworkType === "upload") {
    const { cw } = await inquirer.prompt({
      type: "editor",
      name: "cw",
      message: "Classwork:",
    });
    classworkText = cw;
  } else {
    const promptType = classworkType === "assessment" ? "assessment" : "classnotes";
    const spinner = ora("Generating...").start();
    try {
      const result = await generateClasswork(
        currentClass.methods || "",
        currentClass.description || "",
        promptType,
        student.age,
        student.current_level || "",
        student.notes || ""
      );
      spinner.stop();
      classworkText = result.classwork;
      console.log(`\nGenerated: ${classworkText.slice(0, 200)}...`);
    } catch (error) {
      spinner.fail("Failed");
      printError(error instanceof Error ? error.message : String(error));
      return;
    }

    const { edit } = await inquirer.prompt({
      type: "confirm",
      name: "edit",
      message: "Edit before saving?",
      default: false,
    });

    if (edit) {
      const { cw } = await inquirer.prompt({
        type: "editor",
        name: "cw",
        message: "Classwork:",
        default: classworkText,
      });
      classworkText = cw;
    }
  }

  // Mark class completed, move to step 2
  const spinner = ora("Saving...").start();
  try {
    await updateClass(currentClass.class_id, {
      classwork: classworkText,
      status: "current", // keep as current until Step 2 finishes
    });
    await updateStudentInfo(studentId, { step: 2 });
    spinner.succeed("Saved! Next: continue to check hw.");
  } catch (error) {
    spinner.fail("Failed");
    printError(error instanceof Error ? error.message : String(error));
  }
}

async function handleStep2(
  studentId: number,
  student: Student,
  currentClass: StudentClass,
  allClasses: StudentClass[]
): Promise<void> {
  console.log("\n--- Step 2: HW feedback & finish ---");
  console.log(`Class: ${currentClass.name}`);

  // Check if this is a "coming back" visit (hw already assigned)
  if (currentClass.hw) {
    console.log(`\nHomework: ${currentClass.hw.slice(0, 100)}...`);
    
    // Get hw feedback directly
    console.log("\nHow did they do on their homework?");
    const { hwFeedback } = await inquirer.prompt({
      type: "editor",
      name: "hwFeedback",
      message: "HW feedback:",
      default: currentClass.hw_notes || "",
    });

    if (hwFeedback && hwFeedback.trim()) {
      await updateClass(currentClass.class_id, { hw_notes: hwFeedback });
      console.log("Saved feedback!");
    }
    
    // Now finish
    await finishClassAndRegenerate(studentId, student, currentClass);
    return;
  }

  // First visit - do full analysis + hw flow
  // 1. Get teacher notes on how class went
  console.log("\nHow did they do in class? What did you actually teach? (Ctrl+D when done)");
  const { classNotes } = await inquirer.prompt({
    type: "editor",
    name: "classNotes",
    message: "Class notes:",
  });

  // 2. AI analyzes
  const { useAI } = await inquirer.prompt({
    type: "confirm",
    name: "useAI",
    message: "Generate analysis?",
    default: true,
  });

  let analysis = { notes: "", taught_methods: "", needs_practice: "" };
  if (useAI) {
    const spinner = ora("Analyzing...").start();
    try {
      analysis = await analyzeClass(
        student.current_level || "",
        currentClass.description || "",
        currentClass.methods || "",
        currentClass.classwork || "",
        classNotes
      );
      spinner.stop();
      console.log(`\nTaught: ${analysis.taught_methods}`);
      console.log(`Needs practice: ${analysis.needs_practice}`);
      console.log(`Notes: ${analysis.notes}`);
    } catch (error) {
      spinner.fail("Failed");
      printError(error instanceof Error ? error.message : String(error));
    }
  }

  // 3. Save analysis
  const { saveAnalysis } = await inquirer.prompt({
    type: "confirm",
    name: "saveAnalysis",
    message: "Save analysis?",
    default: true,
  });
  if (saveAnalysis) {
    await updateClass(currentClass.class_id, {
      notes: analysis.notes,
      taught_methods: analysis.taught_methods,
      needs_practice: analysis.needs_practice,
    });
  }

  // 4. Ask about homework - now go back to hw flow
  await runHomeworkFlow(studentId, student, currentClass);
}

async function runHomeworkFlow(
  studentId: number,
  student: Student,
  currentClass: StudentClass
): Promise<void> {
  if (currentClass.hw) {
    console.log(`\nCurrent Homework: ${currentClass.hw.slice(0, 100)}...`);
  }

  const { hwChoice } = await inquirer.prompt({
    type: "list",
    name: "hwChoice",
    message: "Homework:",
    choices: [
      { name: "Generate (HWGPT)", value: "hw" },
      { name: "Generate (Creative)", value: "creative" },
      { name: "Upload", value: "upload" },
      { name: "Skip", value: "none" },
    ],
    default: "none",
  });

  let hwText = "";
  if (hwChoice === "upload") {
    const { hw } = await inquirer.prompt({
      type: "editor",
      name: "hw",
      message: "Homework:",
    });
    hwText = hw;
  } else if (hwChoice === "hw" || hwChoice === "creative") {
    const spinner = ora("Generating homework...").start();
    try {
      const result = await generateHomework(
        student.current_level || "",
        currentClass.description || "",
        currentClass.methods || "",
        currentClass.classwork || "",
        "", // taught methods
        ""  // needs practice
      );
      spinner.stop();
      hwText = result.hw;
      console.log(`\nGenerated: ${hwText?.slice(0, 200)}...`);
    } catch (error) {
      spinner.fail("Failed");
      printError(error instanceof Error ? error.message : String(error));
    }

    const { edit } = await inquirer.prompt({
      type: "confirm",
      name: "edit",
      message: "Edit?",
      default: false,
    });
    if (edit) {
      const { hw } = await inquirer.prompt({
        type: "editor",
        name: "hw",
        message: "Homework:",
        default: hwText,
      });
      hwText = hw;
    }
  }

  // Save homework
  if (hwText.trim()) {
    await updateClass(currentClass.class_id, { hw: hwText });
  }

  // Send email to student's accounts if homework was assigned
  if (hwText.trim()) {
    const emailSpinner = ora("Sending notification emails...").start();
    try {
      const accounts = await getAccountsForStudent(studentId);
      const emailCtx: EmailContext = {
        studentName: student.name,
        className: currentClass.name,
        taughtMethods: currentClass.taught_methods || "",
        needsPractice: currentClass.needs_practice || "",
        classDescription: currentClass.description || "",
        intendedMethods: currentClass.methods || "",
        stretchMethods: currentClass.stretch_methods || "",
      };

      let sentCount = 0;
      for (const account of accounts) {
        if (account.email) {
          const ok = await sendHomeworkEmail(account.email, account.name, emailCtx);
          if (ok) sentCount++;
        }
      }

      if (sentCount > 0) {
        emailSpinner.succeed(`Sent emails to ${sentCount} account(s)`);
      } else {
        emailSpinner.info("No email addresses found or emails disabled");
      }
    } catch (error) {
      emailSpinner.fail("Failed to send emails");
      console.error(error instanceof Error ? error.message : String(error));
    }
  }

  // Ask to finish now or check hw first
  const { nextAction } = await inquirer.prompt({
    type: "list",
    name: "nextAction",
    message: "What's next?",
    choices: [
      { name: "Finish (mark completed & regenerate)", value: "finish" },
      { name: "Check hw on web first, come back later", value: "later" },
    ],
  });

  if (nextAction === "finish") {
    await finishClassAndRegenerate(studentId, student, currentClass);
  } else {
    console.log("\n✓ Keep going! Check homework on app.codeabode.co,");
    console.log("  then Continue again to give feedback before finishing.\n");
  }
}

async function finishClassAndRegenerate(
  studentId: number,
  student: Student,
  currentClass: StudentClass
): Promise<void> {
  const spinner = ora("Finishing...").start();
  try {
    // Mark completed
    await updateClass(currentClass.class_id, {
      status: "completed",
      hw_notes: "saved in prev step",
    });

    // Delete all upcoming
    await d1Exec(`DELETE FROM students_classes WHERE student_id = ${studentId} AND status = 'upcoming'`);

    spinner.stop();
  } catch (error) {
    spinner.fail("Failed");
    printError(error instanceof Error ? error.message : String(error));
    return;
  }

  // Now regenerate curriculum
  console.log("\n=== Regenerate Curriculum ===");
  const { planChoice } = await inquirer.prompt({
    type: "list",
    name: "planChoice",
    message: "Plan next:",
    choices: [
      { name: "Plan with AI", value: "plan" },
      { name: "One exploration class", value: "exploration" },
    ],
  });

  let newCurrentClassId = currentClass.class_id;

  if (planChoice === "plan") {
    const allClasses = await getStudentClasses(studentId);
    const curSpinner = ora("Generating...").start();
    let curriculum;
    try {
      curriculum = await generateCurriculum(
        student.current_level || "",
        student.final_goal || "",
        student.notes || "",
        allClasses
      );
      curSpinner.stop();
    } catch (error) {
      curSpinner.fail("Failed");
      printError(error instanceof Error ? error.message: String(error));
      return;
    }

    console.log(`\nGenerated ${curriculum.classes.length} classes`);
    const { save } = await inquirer.prompt({
      type: "confirm",
      name: "save",
      message: "Save?",
      default: true,
    });

    if (save) {
      let lowestId = 0;
      for (const c of curriculum.classes) {
        const methodsStr = Array.isArray(c.methods) ? c.methods.join(", ") : (c.methods || "");
        const stretchStr = Array.isArray(c.stretch_methods) ? c.stretch_methods.join(", ") : (c.stretch_methods || "");
        const id = await createClass(
          studentId,
          c.name,
          "",
          "",
          methodsStr,
          stretchStr,
          c.description || "",
          "upcoming"
        );
        if (!lowestId || id < lowestId) lowestId = id;
      }

      await updateStudentInfo(studentId, {
        current_level: curriculum.current_level,
        final_goal: curriculum.final_goal,
        notes: curriculum.notes,
        current_class: lowestId,
        step: 1,
      });
      newCurrentClassId = lowestId;
      console.log("Saved!");
    }
  } else {
    // Exploration class
    const date = new Date().toISOString().split("T")[0];
    const name = `Exploration ${date}`;
    const id = await createClass(
      studentId,
      name,
      "",
      "",
      "",
      "",
      "Student-led exploration",
      "upcoming"
    );
    await updateStudentInfo(studentId, { current_class: id, step: 1 });
    newCurrentClassId = id;
    console.log("Created exploration class.");
  }

  console.log("\nCycle complete! Next continue will be Step 1.");
}

async function handleNewClass(
  studentId: number,
  student: Student,
  allClasses: StudentClass[]
): Promise<void> {
  const { newChoice } = await inquirer.prompt({
    type: "list",
    name: "newChoice",
    message: "What's next?",
    choices: [
      { name: "Plan with AI", value: "plan" },
      { name: "Unplanned exploration", value: "unplanned" },
    ],
  });

  if (newChoice === "plan") {
    const spinner = ora("Generating...").start();
    let curriculum;
    try {
      curriculum = await generateCurriculum(
        student.current_level || "",
        student.final_goal || "",
        student.notes || "",
        allClasses
      );
      spinner.stop();
    } catch (error) {
      spinner.fail("Failed");
      printError(error instanceof Error ? error.message : String(error));
      return;
    }

    console.log(`\nGenerated ${curriculum.classes.length} classes.`);
    const { save } = await inquirer.prompt({
      type: "confirm",
      name: "save",
      message: "Save?",
      default: true,
    });

    if (save) {
      for (const c of curriculum.classes) {
        await createClass(studentId, c.name, "", "", c.methods, c.stretch_methods, c.description, "upcoming");
      }
      console.log("Saved!");
    }
  } else {
    const name = `Exploration (${new Date().toISOString()})`;
    await createClass(studentId, name, "", "", "", "", "Exploration", "upcoming");
    console.log("Created.");
  }
}

async function recordClasswork(
  studentId: number,
  currentClass: StudentClass
): Promise<void> {
  console.log("\n--- Record Classwork ---");
  console.log("Press Ctrl+D when done\n");

  const { classwork } = await inquirer.prompt({
    type: "editor",
    name: "classwork",
    message: "Classwork:",
    default: currentClass.classwork || "",
  });

  if (!classwork || classwork.trim() === "") {
    printError("Classwork cannot be empty");
    return;
  }

  const { notes } = await inquirer.prompt({
    type: "input",
    name: "notes",
    message: "Notes (optional):",
  });

  const spinner = ora("Saving...").start();
  try {
    await updateClasswork(currentClass.class_id, classwork, notes || "");
    spinner.succeed("Saved!");
    printSuccess("Classwork recorded");
  } catch (error) {
    spinner.fail("Failed to save");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runGenerateClasswork(
  studentId: number,
  currentClass: StudentClass
): Promise<void> {
  const methods = currentClass.methods || "";
  const description = currentClass.description || "";

  console.log("\n--- Generate Classwork with GPT ---");
  console.log(`  Methods: ${methods}`);
  console.log(`  Description: ${description}\n`);

  const { confirm } = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    message: "Generate classwork and homework?",
    default: true,
  });

  if (!confirm) {
    return;
  }

  const spinner = ora("Generating with GPT...").start();

  let generated;
  try {
    generated = await generateClasswork(methods, description);
    spinner.stop();
  } catch (error) {
    spinner.fail("Generation failed");
    printError(
      error instanceof Error ? error.message : String(error)
    );
    return;
  }

  console.log("\nGenerated:");
  console.log(`  Classwork: ${generated.classwork}`);
  console.log(`  Homework: ${generated.homework}`);
  if (generated.notes) {
    console.log(`  Notes: ${generated.notes}`);
  }

  const { save } = await inquirer.prompt({
    type: "confirm",
    name: "save",
    message: "Save to database?",
    default: true,
  });

  if (!save) {
    return;
  }

  const saveSpinner = ora("Saving...").start();
  try {
    await updateGeneratedClasswork(
      currentClass.class_id,
      generated.classwork,
      generated.homework,
      generated.notes
    );
    saveSpinner.succeed("Saved!");
    printSuccess("Classwork saved to database");
  } catch (error) {
    saveSpinner.fail("Failed to save");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runNewClass(studentId: number): Promise<void> {
  console.log("\n--- Create New Class ---");

  const { name } = await inquirer.prompt({
    type: "input",
    name: "name",
    message: "Class name:",
    validate: (input) =>
      input.trim() !== "" || "Name is required",
  });

  const { classType } = await inquirer.prompt({
    type: "list",
    name: "classType",
    message: "Class type:",
    choices: [
      { name: "Traditional (instructor-led)", value: "traditional" },
      { name: "Experimental (project-based)", value: "experimental" },
      { name: "Self-directed (student-driven)", value: "self_directed" },
    ],
    default: "traditional",
  });

  const { classDate } = await inquirer.prompt({
    type: "input",
    name: "classDate",
    message: "Class date (YYYY-MM-DD, optional):",
    default: new Date().toISOString().split("T")[0],
  });

  const { methods } = await inquirer.prompt({
    type: "input",
    name: "methods",
    message: "Methods (comma-separated):",
  });

  const { stretchMethods } = await inquirer.prompt({
    type: "input",
    name: "stretchMethods",
    message: "Stretch methods (optional):",
  });

  const { description } = await inquirer.prompt({
    type: "input",
    name: "description",
    message: "Description:",
  });

  const spinner = ora("Creating class...").start();

  try {
    await createClass(
      studentId,
      name.name,
      classType.classType,
      classDate.classDate,
      methods.methods,
      stretchMethods.stretchMethods || "",
      description.description || ""
    );
    spinner.succeed("Created!");
    printSuccess(`Class "${name.name}" created`);
  } catch (error) {
    spinner.fail("Failed to create class");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function runNew(): Promise<void> {
  console.log("\n--- Create New Student ---");

  const { name } = await inquirer.prompt({
    type: "input",
    name: "name",
    message: "Student name:",
    validate: (input) =>
      input.trim() !== "" || "Name is required",
  });

  const { age } = await inquirer.prompt({
    type: "input",
    name: "age",
    message: "Age:",
    validate: (input) => {
      const num = parseInt(input);
      return (
        !isNaN(num) ||
        "Please enter a valid number"
      );
    },
    filter: (input) => parseInt(input),
  });

  const { level } = await inquirer.prompt({
    type: "list",
    name: "level",
    message: "Level:",
    choices: [
      "beginner",
      "intermediate",
      "advanced",
    ],
    default: "beginner",
  });

  const { goal } = await inquirer.prompt({
    type: "input",
    name: "goal",
    message: "Goal (e.g., build games, apps):",
  });

  const spinner = ora("Creating student...").start();

  try {
    await createStudent(
      name,
      age,
      level,
      goal.goal || ""
    );
    spinner.succeed("Created!");
    printSuccess(`Student "${name}" created`);
  } catch (error) {
    spinner.fail("Failed to create student");
    printError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function runCli(): Promise<void> {
  console.log(`
${ORANGE}
   _    __  _ _____
  | |  /  \| |_   \
  | | / /\ \ |/) |
  | |/ /_\ \| (_) |
  |___/___ \__\___/  CLI
${ORANGE}
  `);

  const { mode } = await inquirer.prompt({
    type: "list",
    name: "mode",
    message: "Database mode:",
    choices: [
      { name: "Remote (Cloudflare D1)", value: "remote" },
      { name: "Local (wrangler dev)", value: "local" },
    ],
    default: "remote",
  });

  setD1Mode(mode as "remote" | "local");
  console.log(`\nConnected to: ${mode === "remote" ? "🌐 Remote" : "💻 Local"} database\n`);

  while (true) {
      const { action } = await inquirer.prompt({
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: "Continue (manage student)", value: "continue" },
        { name: "List students", value: "list" },
        { name: "New student", value: "new" },
        { name: "Delete student", value: "delete" },
        { name: "Switch database", value: "switch" },
        { name: "Exit", value: "exit" },
      ],
      default: "list",
    });

    if (action === "exit") {
      console.log("\n👋 Goodbye!\n");
      break;
    }

    if (action === "switch") {
      const newMode = mode === "remote" ? "local" : "remote";
      setD1Mode(newMode);
      console.log(`\nSwitched to: ${newMode === "remote" ? "🌐 Remote" : "💻 Local"} database\n`);
      continue;
    }

    switch (action) {
      case "list":
        await runList();
        break;
      case "continue":
        await runContinue();
        break;
      case "new":
        await runNew();
        break;
      case "delete":
        await runDelete();
        break;
    }
  }
}