# webapp
Codeabode's web application. Or at least, the backend provided by it.

## Getting started

```bash
git clone https://github.com/codeabode101/webapp.git
cd webapp
```

## Building

Add the `DATABASE_URL` in your `.env` file, it is also necessary during compile time for `sqlx`.

If you are setting up your database for the first time, run these commands after giving a PostgreSQL url:

```bash
cargo install sqlx-cli
sqlx database create
sqlx migrate run
```

Build the binary:

```bash
cargo build
cargo build --bin adduser
```

Add your students via the codeabode cli first. This project will be ported to rust soon, but for now get it from `https://github.com/codeabode101/agents`.

Then run `adduser` to add a "user" to hold information about your students. That's the user that you can log in with to view info about your students.

```bash
cargo run --bin adduser
```

There may also be a binary provided in releases.

## API

- POST `/api/login` with username and password (bcrypt hashed with cost 10). If valid, you will receive `Set-Cookie:` headers with usernames and passwords
- POST `/api/reset-password`. Same fields (ignores your cookies) except with a `new_password` field
- POST `/api/list_students` with cookies. Get a list of students.
- POST `/api/get_student/{student_id}` with cookies. Get a single student and all information related to this student.

## Goals

1. codeabode cli should be a tool entirely written in rust. All administrative functionality can happen in rust, and if necessary the cli will spawn in a simple TUI as well. 
2. The backend will provide endpoints for viewing student progress over the codeabode web tool;gc
3. Users should be able to use a cli tool (whether the same or a different one, doesn't particularly matter yet) to retrieve assignment instructions, hw instructions, and to be able to submit their hw. These users will interact with the backend
