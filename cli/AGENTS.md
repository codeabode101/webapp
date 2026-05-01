# Codeabode CLI Agent Guidelines

## Overview
CLI tool for managing coding students, tracking classes, generating curriculum, and sending homework emails.

## Database
- Cloudflare D1 (remote mode)
- Tables: students, students_classes, accounts

## Key Concepts

### Student Flow
1. **Step 1**: After class - generate classwork/hw for next class
2. **Step 2**: Next class - review previous class, give feedback on completed hw

### Class Statuses
- `current`: Active class being worked on
- `completed`: Finished class with notes/analysis
- `upcoming`: Planned future classes

### Important Fields
- `students.step`: 1 = plan next, 2 = review/complete
- `students.current_class`: ID of current class to work on
- `students_classes.hw_notes`: Teacher feedback on completed hw

## Testing
- Use existing students (Mithran, Seyon, Yash, rami) for testing
- Create test students with "New student" then delete with "Delete student"
- Run locally: `npm start` in cli directory

## Adding Features
1. Understand the existing flow before modifying
2. Check how step/classes work together
3. Test with real student data
4. Consider the "teacher workflow" - class → hw → feedback → plan next

## Common Flows
- **After class (Step 1)**: Generate classwork, save, then set up next class
- **Review class (Step 2)**: Enter class notes, generate analysis, save, then regenerate curriculum
- **Hw feedback**: After class completed and student does hw, teacher gives feedback on it