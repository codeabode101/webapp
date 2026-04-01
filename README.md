# Codeabode

A Rust-based CLI tool for managing 1:1 coding curriculum and lesson planning. Powered by AI (Hack Club API) to generate personalized lesson plans, classwork, assessments, and homework for students.

## Features

- **AI-Powered Curriculum Generation** - Creates personalized learning paths based on student goals
- **Planned Classes** - Pre-structured lessons with defined methods and learning objectives
- **Unplanned/Exploration Classes** - Flexible sessions where you teach freely, then record what was taught
- **Automated Classwork & Homework** - Generate engaging assignments based on what students learned
- **Class Analysis** - Track `taught_methods` vs `needs_practice` for each student
- **PostgreSQL Backend** - Robust data storage with compile-time query validation via `sqlx`

## Tech Stack

- **Language**: Rust
- **Database**: PostgreSQL with `sqlx` (compile-time checked queries)
- **AI API**: Hack Club (`https://ai.hackclub.com/proxy/v1`)
- **CLI**: `clap` for command parsing
- **Async**: `tokio` runtime

## Installation

### Prerequisites

- Rust (1.70+)
- PostgreSQL
- Hack Club API key

### Setup

```bash
# Clone and build
cd webapp
cargo build --release

# Copy binary to PATH (optional)
cp target/release/codeabode ~/.local/bin/
```

### Configuration

Create a `.env` file in the project root:

```env
# Required: Hack Club API key for AI features
HACKCLUB_API_KEY=sk-hc-v1-your-key-here

# Required: PostgreSQL connection string
DATABASE_URL=postgres://localhost/codeabode

# Optional: For email notifications
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Required for password hashing
BCRYPT_SALT=your-random-salt
```

## Database Setup

```sql
-- Create database
createdb codeabode

-- Run migrations (if you have them)
# Or manually create tables:

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    current_level TEXT NOT NULL,
    final_goal TEXT NOT NULL,
    future_concepts TEXT[] NOT NULL,
    notes TEXT,
    account_id INTEGER[],
    current_class INTEGER REFERENCES students_classes(class_id),
    step INTEGER NOT NULL DEFAULT 0,
    sent_email BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE students_classes (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    class_id SERIAL PRIMARY KEY,
    status VARCHAR(15) NOT NULL,
    name TEXT NOT NULL,
    methods TEXT[] NOT NULL,
    stretch_methods TEXT[],
    description TEXT NOT NULL,
    classwork TEXT,
    notes TEXT,
    hw TEXT,
    hw_notes TEXT,
    taught_methods TEXT[],
    needs_practice TEXT[]
);

CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    email VARCHAR(255)
);
```

## CLI Commands

### `codeabode new` (alias: `n`)

Create a new student with AI-generated curriculum.

```bash
cargo run --bin codeabode -- new
```

**Flow:**
1. Enter student description (age, goals, current level, interests)
2. AI generates curriculum with classes and learning path
3. Enter student name and age
4. Choose to **generate** or **upload** first class classwork
5. If generating, enter teacher notes for context

**Example:**
```
Give me information about the student then hit Ctrl + D.
> Student named Alex, age 13, wants to learn Python to make Minecraft mods. 
  Knows basic variables but nothing else.
Done reading.

[AI generates curriculum...]

Name: Alex
Age: 13

(u)pload or (g)enerate the first class? g
Teacher wants to focus on variables and print statements first
[AI generates classwork...]
```

---

### `codeabode continue` (alias: `c`)

Continue with an existing student - the main workflow command.

```bash
cargo run --bin codeabode -- continue
```

**Flow:**

1. **Select student** from the list

2. **If student is at step 1** (curriculum planning phase):
   - Shows student history and previous classes
   - Asks for homework notes from last class
   - **Plan future classes or leave unplanned?**
     - `(p)lan` - AI generates structured curriculum
     - `(u)nplanned` - Free-form exploration (no pre-planned methods)
   - Choose class type:
     - `(A)ssessment` - Generate assessment
     - `(m)inute warm up` - Class with warmup activity
     - `(u)pload` - Upload your own classwork
     - `(g)enerate` - AI generates class notes
     - `(n)one` - Skip class notes

3. **If student is at step 2** (homework generation phase):
   - Shows classwork from the completed class
   - Asks: *"How did they do in class? What did you actually teach?"*
   - AI analyzes and extracts:
     - `taught_methods` - What student mastered
     - `needs_practice` - Areas needing work
     - `notes` - Parent-friendly summary
   - **Generate homework?** (y/n)
     - `(u)pload` - Upload your own assignment
     - `(5) day` - Generate 5-day project
     - `(c)reative` - Generate creative assignment

---

### `codeabode add`

Create a new user account (teacher/parent).

```bash
cargo run --bin codeabode -- add
```

**Flow:**
1. Enter username, name, password
2. Optionally add email
3. Optionally associate with existing students

---

### `codeabode edit`

Edit user's student associations.

```bash
cargo run --bin codeabode -- edit
```

**Options:**
- `(a)dd` a student to user
- `(r)emove` a student from user
- `(c)ancel`

---

### `codeabode email`

Modify a user's email address.

```bash
cargo run --bin codeabode -- email
```

**Options:**
1. Set new email
2. Clear email (set to NULL)
3. Cancel

---

### `codeabode reset` (alias: `r`, `reset-password`)

Reset a user's password.

```bash
cargo run --bin codeabode -- reset
```

---

## Workflows

### Planned Class Workflow

For structured, pre-planned lessons:

```bash
# 1. Create student (or continue existing)
cargo run --bin codeabode -- continue

# 2. Choose student
> 0

# 3. Plan curriculum
Plan future classes or leave next class unplanned? (p)lan
> p

# 4. AI generates classes with methods
[Shows planned classes with methods like: "if statements", "loops", etc.]

# 5. Generate classwork
(A)ssessment, (m)inute warm up, (u)pload, (g)enerate, (n)one
> g

# 6. Enter teacher notes
> Student struggles with syntax, go slow

# 7. Later: Generate homework
cargo run --bin codeabode -- continue
> 0
[AI shows what was taught, generates homework based on planned methods]
```

---

### Unplanned Class Workflow

For flexible, student-led exploration:

```bash
# 1. Continue existing student
cargo run --bin codeabode -- continue

# 2. Choose student
> 0

# 3. Choose unplanned
Plan future classes or leave next class unplanned? (u)nplanned
> u
Setting up unplanned exploration class...

# 4. Generate or upload classwork
(A)ssessment, (m)inute warm up, (u)pload, (g)enerate, (n)one
> g

# 5. Enter teacher notes (can be minimal)
> Student wants to explore game development, no specific plan

# 6. Teach your class! (use the generated classwork or your own)

# 7. After class: Record what was taught
cargo run --bin codeabode -- continue
> 0

[Shows class notes]

How did they do in class? What did you actually teach? (Ctrl+D to finish)
> We covered variables, print(), and input(). 
> Student made a mad libs game and understood the concepts well.
> Struggled a bit with string concatenation.

[AI analyzes and extracts:]
- taught_methods: ["print()", "input()", "variables", "string concatenation"]
- needs_practice: ["string concatenation"]
- notes: "Student showed good understanding of basic I/O operations..."

Generate homework? (y/n): y
(u)pload, (5) day, or (c)reative: c
[AI generates homework based on what was actually taught]
```

---

### Assessment Workflow

```bash
cargo run --bin codeabode -- continue
> 0
Plan future classes? (p)lan
> p

(A)ssessment, (m)inute warm up, (u)pload, (g)enerate, (n)one
> A

[AI generates assessment with:]
- Warm-up questions (recall)
- Build It! section (main task)
- Extra credit (challenge)

[Student completes assessment]

[Later] Generate homework based on assessment performance...
```

---

## Database Schema

### `students`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR | Student name |
| `age` | INTEGER | Student age |
| `current_level` | TEXT | Current skill level |
| `final_goal` | TEXT | End goal (e.g., "Build RPG game") |
| `future_concepts` | TEXT[] | Ordered learning path |
| `notes` | TEXT | Special needs, interests, etc. |
| `account_id` | INTEGER[] | Associated teacher accounts |
| `current_class` | INTEGER | FK to current class |
| `step` | INTEGER | 1 = planning, 2 = homework generation |
| `sent_email` | BOOLEAN | Email notification flag |

### `students_classes`

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | INTEGER | FK to student |
| `class_id` | SERIAL | Primary key |
| `status` | VARCHAR | `upcoming` or `completed` |
| `name` | TEXT | Class name |
| `methods` | TEXT[] | **Planned** methods to teach |
| `stretch_methods` | TEXT[] | Optional extension topics |
| `description` | TEXT | Class description |
| `classwork` | TEXT | Generated/uploaded class notes |
| `notes` | TEXT | Analysis notes (parent-friendly) |
| `hw` | TEXT | Homework assignment |
| `hw_notes` | TEXT | Homework feedback |
| `taught_methods` | TEXT[] | **Actually taught** methods |
| `needs_practice` | TEXT[] | Areas needing reinforcement |

### `accounts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `username` | VARCHAR | Unique username |
| `name` | VARCHAR | Display name |
| `password` | TEXT | SHA-512 hashed |
| `email` | VARCHAR | Optional email for notifications |

---

## AI Prompts

The system uses several specialized prompts:

| Prompt | Purpose |
|--------|---------|
| `CURCGPT_PROMPT` | Generate initial curriculum |
| `CURCGPT_REFINER_PROMPT` | Refine curriculum based on progress |
| `CLASSNOTESGPT_PROMPT` | Generate class notes/lesson plans |
| `ASSESSMENTGPT_PROMPT` | Create assessments |
| `CLASSANALYSIS_PROMPT` | Analyze what was taught |
| `HWGPT_PROMPT` | Generate 5-day homework projects |
| `CREATIVE_HWGPT_PROMPT` | Generate creative assignments |

All prompts are defined in `src/lib.rs`.

---

## Testing

### Run Integration Tests

```bash
# Requires local PostgreSQL database
cargo test --test integration -- --test-threads=1
```

**Tests cover:**
- Database connectivity
- Student CRUD operations
- Class creation (planned & unplanned)
- Step transitions (1 ↔ 2)
- `taught_methods` / `needs_practice` tracking
- Homework generation workflow
- Current class navigation
- Cleanup operations

### Test Database Setup

Tests use the database from `DATABASE_URL`. They automatically clean up test data with names like `Test Student%`.

---

## API Integration

### Hack Club API

The system uses the Hack Club AI proxy:

- **Base URL**: `https://ai.hackclub.com/proxy/v1`
- **Endpoint**: `/chat/completions`
- **Models**: `claude-sonnet-4-20250514`, `deepseek-r1`, etc.
- **Auth**: Bearer token via `HACKCLUB_API_KEY`

### Request Format

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "system", "content": "You are a curriculum expert..."},
    {"role": "user", "content": "Generate a curriculum for..."}
  ],
  "response_format": {
    "type": "json_object"
  }
}
```

---

## Architecture

```
src/
├── bin/
│   └── codeabode.rs    # Main CLI binary
├── lib.rs              # Shared types and prompts
└── ...

tests/
└── integration.rs      # Integration tests
```

### Key Components

1. **HackClubClient** (`src/bin/codeabode.rs`)
   - HTTP client for Hack Club API
   - Manages chat message history
   - Supports JSON-structured responses

2. **Models** (`src/lib.rs`)
   - `Curriculum` - Learning path with classes
   - `Class` - Individual lesson plan
   - `CompletedClass` - Class analysis results

3. **Database Layer**
   - `sqlx` with compile-time query validation
   - Connection pooling via `PgPool`

---

## Troubleshooting

### "Database connection lost"

Ensure PostgreSQL is running and `DATABASE_URL` is correct:

```bash
pg_isready -h localhost
psql -h localhost -U your_user -d codeabode -c "SELECT 1"
```

### "HACKCLUB_API_KEY not set"

Add to your `.env` file:

```env
HACKCLUB_API_KEY=sk-hc-v1-your-key-here
```

### "AI response parsing failed"

The AI sometimes returns malformed JSON. The system uses flexible deserialization with defaults, but you can:
1. Check the debug output for raw responses
2. Adjust prompts in `src/lib.rs`
3. Ensure API key is valid

### Foreign key constraint violations

When creating classes, ensure the student exists:

```sql
SELECT id, name FROM students;
```

---

## Development

### Build Commands

```bash
# Debug build
cargo build --bin codeabode

# Release build (optimized)
cargo build --release --bin codeabode

# Run directly
cargo run --bin codeabode -- continue

# Check without building
cargo check
```

### Adding New Prompts

1. Add constant to `src/lib.rs`:
   ```rust
   pub const MY_PROMPT: &str = r#"
   Your prompt here...
   "#;
   ```

2. Export in module (if needed)

3. Use in `src/bin/codeabode.rs`:
   ```rust
   use webapp::MY_PROMPT;
   
   let mut client = HackClubClient::new(api_key)
       .with_system(MY_PROMPT);
   ```

### Database Migrations

For schema changes, create migration files in `migrations/`:

```bash
migrations/
└── 20250101_add_new_column.sql
```

---

## License

See `LICENSE` file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `cargo test --test integration`
5. Submit a pull request

---

## Support

For issues or questions, contact the Codeabode team.
