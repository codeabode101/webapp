# webapp
Codeabode's web application. Or at least, the backend provided by it.

## Getting started

```bash
git clone https://github.com/codeabode101/webapp.git
cd webapp
```

## Demo
To see how it works, use the demo user:

Username: demo
Password: demo

## Usage
You are **not** supposed to be able to register for accounts. Using the cli tool in bin, you will be able to add people who can access a particular student by running `cargo run --bin codeabode add` or simply running the binary. 

Demo user cannot reset password.

The objective is for the person with the account (i.e. the parent of the kid learning) can VIEW information about the student. However, they cannot change any information about the student.

## Building & Setup

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
cargo build --bin codeabode
```

### codeabode.py

Go to `https://github.com/codeabode101/agents` and download the binary from releases or setup using the guide in `README.md`. 

From there, you can use `./codeabode.py` or you can use the binary compiled with `PyInstaller` in releases. When I say `./codeabode.py`, I refer to whichever of those you may be using, from the **agents repo**.

Make a curriculum using `./codeabode.py curriculum`, this will walk you through creating a student. Make sure you have a **GEMINI_API_KEY** before running this step or else you won't be able to complete the task.

### cli

Only **add** and **reset** work in the cli for now.

Then run `codeabode add` to add a "user" to hold information about your students. That's the user that you can log in with to view info about your students. Then add that user to view it.

You can also do this:

```bash
cargo run --bin codeabode add
```

Now you can run the backend and log in with the credentials you specified during the add user phase, and you will be able to see the student you created with `./codeabode.py curriculum`.

```bash
cargo run
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
