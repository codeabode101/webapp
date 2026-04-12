#!/usr/bin/env node

import "dotenv/config";
import { runCli } from "./cli.js";
import { listStudents, deleteStudent, d1Exec } from "./d1.js";

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "delete-test-students") {
    try {
      const students = await listStudents();
      const testStudents = students.filter(
        (s) => s.name.toLowerCase().includes("test") ||
               s.name.toLowerCase().includes("temp") ||
               s.name.toLowerCase().includes("fake")
      );

      if (testStudents.length === 0) {
        console.log("No test students found.");
        process.exit(0);
      }

      console.log(`Found ${testStudents.length} test students to delete:`);
      for (const s of testStudents) {
        console.log(`  - ${s.name} (${s.id})`);
      }

      console.log("\nDeleting...");
      for (const s of testStudents) {
        await deleteStudent(s.id);
        console.log(`Deleted: ${s.name}`);
      }

      console.log(`\n✅ Deleted ${testStudents.length} test students`);
      process.exit(0);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  if (args[0] === "delete-all") {
    try {
      const students = await listStudents();
      if (students.length === 0) {
        console.log("No students to delete.");
        process.exit(0);
      }

      console.log(`Found ${students.length} students to delete:`);
      for (const s of students) {
        console.log(`  - ${s.name} (${s.id})`);
      }

      console.log("\nDeleting...");
      for (const s of students) {
        await deleteStudent(s.id);
        console.log(`Deleted: ${s.name}`);
      }

      console.log(`\n✅ Deleted ${students.length} students`);
      process.exit(0);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  try {
    await runCli();
  } catch (error) {
    console.error(
      "\n❌ Fatal error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();