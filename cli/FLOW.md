# Codeabode CLI Flow Reference

## Step 1 (after a class finishes, step = 1)
1. Show student info: step, current_level, completed classes (last 3)
2. If no current/upcoming → ask to plan or unplanned
3. Teacher picks: (A)ssessment, (m) warmup, (u)pload, (g)enerate, (n)one
4. Generate classwork using corresponding prompt
5. Teacher can edit output before saving
6. Mark class as completed
7. step = 2

## Step 2 (hw done, step = 2)
1. Show student info, classwork from step 1
2. Teacher writes notes on how class went (Ctrl+D)
3. AI analyzes → saves taught_methods, needs_practice, notes
4. Teacher chooses hw: Generate (HWGPT or CREATIVE_HW), Upload, or None
5. If generating: AI generates, teacher can edit before saving to hw
6. Teacher writes hw_notes (feedback on hw)
7. Mark class completed
8. DELETE all upcoming classes
9. Regenerate curriculum (plan with AI or one exploration)
10. Set new current_class (lowest class_id)
11. step = 1

## Prompts
- CURCGPT_PROMPT: Initial curriculum generation
- CURCGPT_REFINER_PROMPT: Refine after class feedback
- CLASSNOTESGPT_PROMPT: 10-min warmup
- ASSESSMENTGPT_PROMPT: In-class assessment
- CLASSANALYSIS_PROMPT: Analyze what was taught
- HWGPT_PROMPT: Standard homework
- CREATIVE_HWGPT_PROMPT: Creative homework

## Class Status Flow
- Class ends → step 1 generates classwork → status = completed, step = 2
- Continue again → step 2 analysis + hw → DELETE upcoming → regenerate curriculum → new current_class