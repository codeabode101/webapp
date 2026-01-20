use clap::Command;
use dotenv::dotenv;
use gemini_client_api::gemini::{
    ask::Gemini,
    types::{
        request::SystemInstruction,
        sessions::Session,
    },
};
use sqlx::{postgres::PgPoolOptions};
use std::{
    env,
    io::{self, Write},
};

use webapp::{
    Curriculum,
    CURCGPT_PROMPT,
    CURCGPT_FORMAT,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = PgPoolOptions::new().connect(&db_url).await?;

    let matches = Command::new("codeabode")
        .subcommand(Command::new("add").about("Add a new user"))
        .subcommand(Command::new("edit").about("Edit user's student associations"))
        .subcommand(Command::new("reset")
                        .aliases(["r", "reset-password"])
                        .about("Reset user password"))
        .subcommand(Command::new("curriculum")
                        .aliases(["curc", "c"])
                        .about("Generate curriculum for new student"))
        .subcommand(Command::new("classwork")
                        .aliases(["cw", "w"])
                        .about("Create classwork for upcoming class"))
        .subcommand(Command::new("homework")
                        .aliases(["hw", "h"])
                        .about("Create classwork for upcoming class"))
        .subcommand(Command::new("refine")
                        .aliases(["refiner", "curc-refiner", "re"])
                        .about("Create classwork for upcoming class"))
        .get_matches();

    match matches.subcommand() {
        Some(("add", _)) => add_user(db).await?,
        Some(("edit", _)) => edit_user_students(db).await?,
        Some(("reset", _)) => reset_pswd(db).await?,
        Some(("curriculum", _)) => curriculum(db).await?,
        _ => {
            eprintln!("Invalid command, use run codeabode help");
        }
    }
    Ok(())
}

async fn add_user(
    db: sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut username = String::new();
    get_response("Enter unique username", &mut username)?;

    let mut name = String::new();
    get_response("Enter name", &mut name)?;

    let mut password = String::new();
    get_response("Enter password", &mut password)?;

    match sqlx::query!(
        "INSERT INTO accounts 
        (username, name, password) 
        VALUES ($1, $2, digest($3, 'sha512'))
        RETURNING id",
        username.trim(),
        name.trim(),
        password.trim()
    )
    .fetch_one(&db)
    .await {
        Ok(row) => {
            println!("User created with id: {}", row.id);

            // list all students 
            let students = sqlx::query!(
                "SELECT id, name
                FROM students"
            )
            .fetch_all(&db)
            .await?;

            let mut i = 0;
            while i < students.len() {
                println!("({}) {}: {}", i, students[i].id, students[i].name);
                i += 1;
            }

            loop {
                print!("Would you like to add a student? [Y/n]: ");
                io::stdout().flush()?;

                let mut input = String::new();
                io::stdin().read_line(&mut input)?;

                match input.to_lowercase().trim() {
                    "y" | "yes" | "" => {
                        let mut student_id = String::new();
                        get_response("Enter student id", &mut student_id)?;
                        let student_id_int = student_id.trim().parse::<usize>()?;
                        sqlx::query!(
                            "UPDATE students
                             SET account_id = 
                                 CASE 
                                     WHEN account_id IS NULL THEN ARRAY[$1::integer]
                                     WHEN NOT (account_id @> ARRAY[$1]) THEN account_id || $1
                                     ELSE account_id
                                 END
                             WHERE id = $2",
                            row.id,
                            students[student_id_int].id
                        )
                        .execute(&db)
                        .await?;
                    },
                    "n" | "no" => break, 
                    _ => {
                        println!("Invalid input");
                        continue;
                    }
                }
            };
        },
        Err(e) => eprintln!("{}", e),
    }

    Ok(())
}

async fn reset_pswd(
    db: sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let students = sqlx::query!(
        "SELECT id, username
        FROM accounts"
    )
    .fetch_all(&db)
    .await?;

    let mut i = 0;
    while i < students.len() {
        println!("({}) {}: {}", i, students[i].id, students[i].username);
        i += 1;
    }

    let mut id = String::new();
    get_response("Num of password to reset", &mut id)?;
    let id_int = id.trim().parse::<usize>()?;

    let mut password = String::new();
    get_response("Enter new password", &mut password)?;

    let query = sqlx::query!(
        "UPDATE accounts 
        SET password = digest($1, 'sha512')
        WHERE id = $2",
        password.trim(),
        students[id_int].id
    )
    .execute(&db)
    .await?;

    println!("{} rows affected", query.rows_affected());

    Ok(())
}

async fn edit_user_students(db: sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // List all users
    let users = sqlx::query!(
        "SELECT id, username, name
        FROM accounts
        ORDER BY id"
    )
    .fetch_all(&db)
    .await?;

    if users.is_empty() {
        println!("No users found.");
        return Ok(());
    }

    println!("Available users:");
    for (i, user) in users.iter().enumerate() {
        println!("({}) {} - {}", i, user.username, user.name);
    }

    let mut user_choice = String::new();
    get_response("Select user number to edit", &mut user_choice)?;
    let user_idx = user_choice.trim().parse::<usize>()?;
    
    if user_idx >= users.len() {
        println!("Invalid selection");
        return Ok(());
    }

    let selected_user = &users[user_idx];

    // Show current students for this user
    let current_students = sqlx::query!(
        "SELECT s.id, s.name
        FROM students s
        WHERE $1 = ANY(s.account_id)
        ORDER BY s.id",
        selected_user.id
    )
    .fetch_all(&db)
    .await?;

    println!("\nUser: {} ({})", selected_user.username, selected_user.name);
    println!("Currently associated students:");
    
    if current_students.is_empty() {
        println!("  No students associated");
    } else {
        for student in &current_students {
            println!("  {}: {}", student.id, student.name);
        }
    }

    // Ask for action
    println!("\nOptions:");
    println!("  (a)dd a student");
    println!("  (r)emove a student");
    println!("  (c)ancel");

    let mut action = String::new();
    get_response("Choose action", &mut action)?;
    let action = action.trim().to_lowercase();

    match action.as_str() {
        "a" | "add" => add_student_to_user(db, selected_user.id).await?,
        "r" | "remove" => remove_student_from_user(db, selected_user.id).await?,
        "c" | "cancel" => println!("Operation cancelled"),
        _ => println!("Invalid action"),
    }

    Ok(())
}

async fn add_student_to_user(
    db: sqlx::PgPool,
    user_id: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get all students NOT currently associated with this user
    // We need to handle the case where account_id might be NULL
    let available_students = sqlx::query!(
        "SELECT s.id, s.name
        FROM students s
        WHERE s.account_id IS NULL 
           OR NOT (s.account_id @> ARRAY[$1::integer])
        ORDER BY s.id",
        user_id
    )
    .fetch_all(&db)
    .await?;

    if available_students.is_empty() {
        println!("No available students to add.");
        return Ok(());
    }

    println!("\nAvailable students to add:");
    for (i, student) in available_students.iter().enumerate() {
        println!("({}) {}: {}", i, student.id, student.name);
    }

    let mut student_choice = String::new();
    get_response("Select student number to add", &mut student_choice)?;
    let student_idx = student_choice.trim().parse::<usize>()?;
    
    if student_idx >= available_students.len() {
        println!("Invalid selection");
        return Ok(());
    }

    let selected_student_id = available_students[student_idx].id;

    // Add the user to the student's account_id array
    let result = sqlx::query!(
        "UPDATE students
         SET account_id = 
             CASE 
                 WHEN account_id IS NULL THEN ARRAY[$1::integer]
                 WHEN NOT (account_id @> ARRAY[$1::integer]) THEN account_id || $1
                 ELSE account_id
             END
         WHERE id = $2
         RETURNING id",
        user_id,
        selected_student_id
    )
    .fetch_optional(&db)
    .await?;

    if result.is_some() {
        println!("Student added successfully!");
    } else {
        println!("Failed to add student. Student may already be associated.");
    }

    Ok(())
}

async fn remove_student_from_user(
    db: sqlx::PgPool,
    user_id: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get current students for this user
    let current_students = sqlx::query!(
        "SELECT s.id, s.name
        FROM students s
        WHERE $1 = ANY(s.account_id)
        ORDER BY s.id",
        user_id
    )
    .fetch_all(&db)
    .await?;

    if current_students.is_empty() {
        println!("No students to remove.");
        return Ok(());
    }

    println!("\nCurrent students (can be removed):");
    for (i, student) in current_students.iter().enumerate() {
        println!("({}) {}: {}", i, student.id, student.name);
    }

    let mut student_choice = String::new();
    get_response("Select student number to remove", &mut student_choice)?;
    let student_idx = student_choice.trim().parse::<usize>()?;
    
    if student_idx >= current_students.len() {
        println!("Invalid selection");
        return Ok(());
    }

    let selected_student_id = current_students[student_idx].id;

    // Remove the user from the student's account_id array
    let result = sqlx::query!(
        "UPDATE students
         SET account_id = array_remove(account_id, $1)
         WHERE id = $2
         RETURNING id",
        user_id,
        selected_student_id
    )
    .fetch_optional(&db)
    .await?;

    if result.is_some() {
        println!("Student removed successfully!");
    } else {
        println!("Failed to remove student.");
    }

    Ok(())
}

fn get_response(question: &str, output: &mut String) 
-> Result<(), Box<dyn std::error::Error>> {
    print!("{}: ", question);
    io::stdout().flush()?;

    io::stdin().read_line(output)?;

    Ok(())
}

async fn curriculum(db: sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    let mut session = Session::new(usize::max_value());
    let ai = Gemini::new(
        env::var("GEMINI_API_KEY").expect("GEMINI_API_KEY not set"),
        "gemini-2.5-flash",
        Some(SystemInstruction::from_str(CURCGPT_PROMPT)),
    )
    .set_json_mode(serde_json::from_str(CURCGPT_FORMAT)?);

    // get info from user
    let mut query = String::new();
    get_response("Explain the goal and needs of the student", &mut query)?;

    let mut response = ai.ask(session.ask_string(query.clone())).await?;

    println!("{}", response.get_text(""));

    print!("(m)odify/(u)pload? ");
    io::stdin().read_line(&mut query)?;

    while query.trim() == "m" {
        print!("> ");
        io::stdin().read_line(&mut query)?;

        response = ai
            .ask(session.ask_string(query.clone()))
            .await?;

        println!("{}", response.get_text(""));

        print!("(m)odify/(u)pload? ");
        io::stdin().read_line(&mut query)?;
    }

    let parsed_json: Curriculum = response.get_json()?;

    let mut name = String::new();
    get_response("Name", &mut name)?;

    let mut age = String::new();
    get_response("Age", &mut age)?;

    let age_int = age.trim().parse::<i32>()?;

    let query = sqlx::query!(
        "INSERT INTO students 
        (name, age, current_level, final_goal, future_concepts)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id",
        name.trim(),
        age_int,
        parsed_json.current_level,
        parsed_json.final_goal,
        &parsed_json.future_concepts
    )
    .fetch_one(&db)
    .await?;

    let mut statuses = Vec::new();
    let mut names = Vec::new();
    let mut methods = Vec::new();
    let mut stretch_methods = Vec::new();
    let mut description = Vec::new();

    for i in 0..parsed_json.classes.len() {
        let class = &parsed_json.classes[i];
        statuses.push(class.status.clone());
        names.push(class.name.clone());
        methods.push(class.methods.clone());
        stretch_methods.push(class.stretch_methods.clone());
        description.push(class.description.clone());
    }

    sqlx::query!(
        "INSERT INTO students_classes 
        (student_id, status, name, methods, 
            stretch_methods, description)
        SELECT $1, status, name, methods, 
            stretch_methods, description
        FROM 
            UNNEST($2::text[], $3::text[], $6::text[]) 
            AS t(status, name, description),
            unnest_2d_1d($4::text[][]) AS methods,
            unnest_2d_1d($5::text[][]) AS stretch_methods
            ",
        query.id,  // Single value used for all rows
        &statuses[..],
        &names[..],
        &methods[..],
        &stretch_methods[..],
        &description[..]
    ).execute(&db).await?;

    Ok(())
}
