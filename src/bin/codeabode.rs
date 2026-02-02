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

// Yes/no prompt macro
macro_rules! yes_no {
    ($prompt:expr) => {{
        loop {
            print!("{} [Y/n]: ", $prompt);
            io::stdout().flush()?;
            
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            
            match input.trim().to_lowercase().as_str() {
                "y" | "yes" | "" => break true,
                "n" | "no" => break false,
                _ => println!("Invalid input. Please enter 'y' or 'n'"),
            }
        }
    }};
    ($prompt:expr, $default_yes:expr) => {{
        loop {
            let prompt_str = if $default_yes {
                format!("{} [Y/n]: ", $prompt)
            } else {
                format!("{} [y/N]: ", $prompt)
            };
            
            print!("{}", prompt_str);
            io::stdout().flush()?;
            
            let mut input = String::new();
            io::stdin().read_line(&mut input)?;
            
            match input.trim().to_lowercase().as_str() {
                "y" | "yes" => break true,
                "n" | "no" => break false,
                "" => break $default_yes,
                _ => println!("Invalid input. Please enter 'y' or 'n'"),
            }
        }
    }};
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = PgPoolOptions::new().connect(&db_url).await?;

    let matches = Command::new("codeabode")
        .subcommand(Command::new("add").about("Add a new user"))
        .subcommand(Command::new("edit").about("Edit user's student associations"))
        .subcommand(Command::new("email").about("Modify the user's email"))
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
        Some(("email", _)) => edit_user_email(db).await?,
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

    // Ask for email
    let email = if yes_no!("Do you want to add an email?", false) {
        let mut email_input = String::new();
        get_response("Enter email", &mut email_input)?;
        Some(email_input.trim().to_string())
    } else {
        None
    };

    match sqlx::query!(
        "INSERT INTO accounts 
        (username, name, password, email) 
        VALUES ($1, $2, digest($3, 'sha512'), $4)
        RETURNING id",
        username.trim(),
        name.trim(),
        password.trim(),
        email  // This will be NULL in the database if None
    )
    .fetch_one(&db)
    .await {
        Ok(row) => {
            println!("User created with id: {}", row.id);

            // List all students
            let students = sqlx::query!(
                "SELECT id, name
                FROM students"
            )
            .fetch_all(&db)
            .await?;

            if !students.is_empty() {
                for (i, student) in students.iter().enumerate() {
                    println!("({}) {}: {}", i, student.id, student.name);
                }
            } else {
                println!("No students found in the database.");
            }

            // Ask if user wants to add students
            if yes_no!("Would you like to add a student?", false) && !students.is_empty() {
                loop {
                    // Show students again for reference
                    for (i, student) in students.iter().enumerate() {
                        println!("({}) {}: {}", i, student.id, student.name);
                    }

                    let mut student_input = String::new();
                    get_response("Enter student number (or 'q' to quit)", &mut student_input)?;
                    
                    if student_input.trim().eq_ignore_ascii_case("q") {
                        break;
                    }

                    match student_input.trim().parse::<usize>() {
                        Ok(student_id_int) if student_id_int < students.len() => {
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
                            println!("Student added successfully!");
                            
                            // Ask if they want to add another
                            if !yes_no!("Add another student?", false) {
                                break;
                            }
                        }
                        Ok(_) => {
                            println!("Invalid student number. Please try again.");
                        }
                        Err(_) => {
                            println!("Please enter a valid number or 'q' to quit.");
                        }
                    }
                }
            }
        },
        Err(e) => eprintln!("Error creating user: {}", e),
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

async fn edit_user_email(db: sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // First, list users so they can choose which one to edit
    println!("Fetching users...");
    
    let users = sqlx::query!(
        "SELECT id, username, name, email 
         FROM accounts 
         ORDER BY id"
    )
    .fetch_all(&db)
    .await?;
    
    if users.is_empty() {
        println!("No users found in the database.");
        return Ok(());
    }
    
    // Display users with their current email status
    println!("\nCurrent users:");
    println!("{:<5} {:<20} {:<20} {:<30}", "ID", "Username", "Name", "Email");
    println!("{}", "-".repeat(80));
    
    for user in &users {
        let email_display = match &user.email {
            Some(email) => email,
            None => "(not set)",
        };
        println!("{:<5} {:<20} {:<20} {:<30}", 
                 user.id, user.username, user.name, email_display);
    }
    
    // Let user select which user to edit
    let mut user_input = String::new();
    get_response("\nEnter user ID to edit (or 'q' to quit)", &mut user_input)?;
    
    if user_input.trim().eq_ignore_ascii_case("q") {
        println!("Operation cancelled.");
        return Ok(());
    }
    
    let user_id: i32 = match user_input.trim().parse() {
        Ok(id) => id,
        Err(_) => {
            println!("Invalid ID. Please enter a number.");
            return Ok(());
        }
    };
    
    // Find the selected user
    let selected_user = users.iter().find(|u| u.id == user_id);
    
    match selected_user {
        Some(user) => {
            println!("\nEditing user: {} (ID: {})", user.username, user.id);
            
            // Show current email
            match &user.email {
                Some(email) => println!("Current email: {}", email),
                None => println!("Current email: (not set)"),
            }
            
            // Ask if they want to change the email
            if yes_no!("Do you want to change the email?", false) {
                // Ask what they want to do with the email
                println!("\nOptions:");
                println!("1. Set new email");
                println!("2. Clear email (set to NULL)");
                println!("3. Cancel");
                
                let mut option_input = String::new();
                get_response("Enter option number", &mut option_input)?;
                
                match option_input.trim() {
                    "1" => {
                        // Set new email
                        let mut new_email = String::new();
                        get_response("Enter new email address", &mut new_email)?;
                        
                        let email_trimmed = new_email.trim();
                        
                        if email_trimmed.is_empty() {
                            println!("Email cannot be empty. Use option 2 to clear email instead.");
                            return Ok(());
                        }
                        
                        // Update with new email
                        match sqlx::query!(
                            "UPDATE accounts 
                             SET email = $1 
                             WHERE id = $2 
                             RETURNING id, email",
                            email_trimmed,
                            user.id
                        )
                        .fetch_one(&db)
                        .await {
                            Ok(updated) => {
                                match updated.email {
                                    Some(email) => println!("✅ Email updated to: {}", email),
                                    None => println!("✅ Email cleared"),
                                }
                            }
                            Err(e) => {
                                eprintln!("❌ Error updating email: {}", e);
                                return Err(Box::new(e));
                            }
                        }
                    }
                    "2" => {
                        // Clear email (set to NULL)
                        if yes_no!("Are you sure you want to clear the email?", false) {
                            match sqlx::query!(
                                "UPDATE accounts 
                                 SET email = NULL 
                                 WHERE id = $1 
                                 RETURNING id, email",
                                user.id
                            )
                            .fetch_one(&db)
                            .await {
                                Ok(_) => {
                                    println!("✅ Email cleared successfully.");
                                }
                                Err(e) => {
                                    eprintln!("❌ Error clearing email: {}", e);
                                    return Err(Box::new(e));
                                }
                            }
                        } else {
                            println!("Operation cancelled.");
                        }
                    }
                    "3" => {
                        println!("Operation cancelled.");
                    }
                    _ => {
                        println!("Invalid option selected.");
                    }
                }
            } else {
                println!("Email not changed.");
            }
        }
        None => {
            println!("User with ID {} not found.", user_id);
        }
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
