CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    current_level TEXT NOT NULL,
    final_goal TEXT NOT NULL,
    future_concepts TEXT[] NOT NULL,
    notes TEXT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students_classes (
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    class_id SERIAL PRIMARY KEY,
    status VARCHAR(15) NOT NULL,
    name TEXT NOT NULL,

    -- if status == "upcoming"
    relevance TEXT,
    methods TEXT[],
    stretch_methods TEXT[],

    -- if status == "assessment"
    skills_tested TEXT[],
    description TEXT,

    classwork TEXT,
    notes TEXT,
    hw TEXT,
    hw_notes TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;
