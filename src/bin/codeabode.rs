use clap::Command;
use dotenv::dotenv;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    transport::smtp::authentication::Credentials,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::{
    env,
    io::{self, Write, Read},
};
use time::OffsetDateTime;

use webapp::{
    Curriculum, CompletedClass,
    CURCGPT_PROMPT, CURCGPT_REFINER_PROMPT,
    CLASSNOTESGPT_PROMPT, ASSESSMENTGPT_PROMPT,
    CLASSANALYSIS_PROMPT, HWGPT_PROMPT, CREATIVE_HWGPT_PROMPT,
};

// ============ Hack Club API Types ============

#[derive(Debug, Serialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct JsonSchema {
    name: String,
    schema: serde_json::Value,
    strict: bool,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    json_schema: Option<JsonSchema>,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

// ============ Hack Club Client ============

struct HackClubClient {
    client: Client,
    api_key: String,
    base_url: String,
    messages: Vec<ChatMessage>,
}

impl HackClubClient {
    fn new(api_key: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            base_url: "https://ai.hackclub.com/proxy/v1".to_string(),
            messages: Vec::new(),
        }
    }

    fn with_system(mut self, system_instruction: &str) -> Self {
        self.messages.push(ChatMessage {
            role: "system".to_string(),
            content: system_instruction.to_string(),
        });
        self
    }

    async fn send_message(&mut self, message: &str) -> Result<String, Box<dyn std::error::Error>> {
        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: message.to_string(),
        });

        let request = ChatRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            messages: self.messages.clone(),
            response_format: None,
        };

        let response = self.client
            .post(&format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?
            .json::<ChatResponse>()
            .await?;

        let content = response.choices[0].message.content.clone();
        self.messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: content.clone(),
        });

        Ok(content)
    }

    async fn send_message_json<T: for<'de> Deserialize<'de> + Serialize>(
        &mut self,
        message: &str,
        _schema: &T,
    ) -> Result<T, Box<dyn std::error::Error>> {
        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: message.to_string(),
        });

        // Use json_object mode instead of json_schema for simpler parsing
        let request = ChatRequest {
            model: "claude-sonnet-4-20250514".to_string(),
            messages: self.messages.clone(),
            response_format: Some(ResponseFormat {
                format_type: "json_object".to_string(),
                json_schema: None,
            }),
        };

        let response = self.client
            .post(&format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?
            .json::<ChatResponse>()
            .await?;

        let content = &response.choices[0].message.content;
        
        eprintln!("DEBUG: Raw API response: {}", content);
        
        // Parse the JSON response
        let parsed: T = serde_json::from_str(content)?;
        
        self.messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: content.clone(),
        });

        Ok(parsed)
    }
}

// ============ Utility Functions ============

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

fn get_choice(prompt: &str, options: &[&str]) -> Result<String, Box<dyn std::error::Error>> {
    loop {
        print!("{}", prompt);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim().to_lowercase();
        
        if options.contains(&input.as_str()) {
            return Ok(input);
        }
        println!("Invalid choice. Please choose from: {:?}", options);
    }
}

fn print_with_pager(text: &str) {
    let mut child = std::process::Command::new("less")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .expect("Failed to start less");

    if let Some(ref mut stdin) = child.stdin {
        stdin.write_all(text.as_bytes()).ok();
    }

    child.wait().ok();
}

fn get_response(question: &str, output: &mut String) -> Result<(), Box<dyn std::error::Error>> {
    print!("{}: ", question);
    io::stdout().flush()?;
    io::stdin().read_line(output)?;
    Ok(())
}

fn get_smtp_transport() -> Result<AsyncSmtpTransport<Tokio1Executor>, Box<dyn std::error::Error>> {
    let host = env::var("SMTP_HOST")?;
    let port = env::var("SMTP_PORT")?.parse::<u16>()?;
    let username = env::var("SMTP_USERNAME")?;
    let password = env::var("SMTP_PASSWORD")?;
    let creds = Credentials::new(username, password);

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)?
        .port(port)
        .credentials(creds)
        .build();
    Ok(mailer)
}

async fn send_email(
    to_name: &str,
    to_email: &str,
    subject: &str,
    body: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let from = env::var("SMTP_FROM")?;
    let mailer = get_smtp_transport()?;

    let email = Message::builder()
        .from(from.parse()?)
        .to(format!("{} <{}>", to_name, to_email).parse()?)
        .subject(subject)
        .body(body.to_string())?;

    mailer.send(email).await?;
    Ok(())
}

// ============ Main ============

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = PgPoolOptions::new().connect(&db_url).await?;

    let matches = Command::new("codeabode")
        .subcommand(Command::new("new").alias("n").about("Create a new student"))
        .subcommand(Command::new("continue").alias("c").about("Continue for existing student"))
        .subcommand(Command::new("add").about("Add a new user"))
        .subcommand(Command::new("edit").about("Edit user's student associations"))
        .subcommand(Command::new("email").about("Modify the user's email"))
        .subcommand(Command::new("reset")
                        .aliases(["r", "reset-password"])
                        .about("Reset user password"))
        .get_matches();

    match matches.subcommand() {
        Some(("new", _)) => new_student(db).await?,
        Some(("continue", _)) => continue_student(db).await?,
        Some(("add", _)) => add_user(db).await?,
        Some(("edit", _)) => edit_user_students(db).await?,
        Some(("email", _)) => edit_user_email(db).await?,
        Some(("reset", _)) => reset_pswd(db).await?,
        _ => {
            eprintln!("Usage: codeabode [COMMAND]");
            eprintln!("\nCommands:");
            eprintln!("    new, n       - create a new student");
            eprintln!("    continue, c  - continue for existing student");
            eprintln!("    add          - add a new user");
            eprintln!("    edit         - edit user's student associations");
            eprintln!("    email        - modify the user's email");
            eprintln!("    reset        - reset user password");
        }
    }
    Ok(())
}

// ============ New Student Flow ============

async fn new_student(db: sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    println!("Give me information about the student then hit Ctrl + D.");
    let mut message = String::new();
    io::stdin().read_to_string(&mut message)?;
    println!("Done reading.");

    let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
    let mut client = HackClubClient::new(api_key)
        .with_system(CURCGPT_PROMPT);

    // Send message and get JSON response
    let parsed: Curriculum = client.send_message_json(&message, &Curriculum {
        current_level: String::new(),
        final_goal: String::new(),
        classes: Vec::new(),
        future_concepts: Vec::new(),
        notes: None,
        has_planned_classes: None,
    }).await?;

    let mut name = String::new();
    get_response("Name", &mut name)?;
    
    let mut age = String::new();
    get_response("Age", &mut age)?;
    let age_int = age.trim().parse::<i32>()?;

    // Insert student
    let student_row = sqlx::query!(
        r#"
        INSERT INTO students (name, age, current_level, final_goal, future_concepts, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        name.trim(),
        age_int,
        parsed.current_level,
        parsed.final_goal,
        &parsed.future_concepts,
        parsed.notes
    )
    .fetch_one(&db)
    .await?;

    let student_id = student_row.id;

    // Insert classes
    let mut class_ids = Vec::new();
    for class in &parsed.classes {
        let row = sqlx::query!(
            r#"
            INSERT INTO students_classes (student_id, status, name, methods, stretch_methods, description)
            VALUES ($1, 'upcoming', $2, $3, $4, $5)
            RETURNING class_id
            "#,
            student_id,
            &class.name,
            &class.methods,
            &class.stretch_methods.clone().unwrap_or_default(),
            &class.description
        )
        .fetch_one(&db)
        .await?;
        class_ids.push(row.class_id);
    }

    // Set current_class to the lowest class_id
    if let Some(&lowest_class_id) = class_ids.iter().min() {
        sqlx::query!(
            "UPDATE students SET current_class = $1 WHERE id = $2",
            lowest_class_id,
            student_id
        )
        .execute(&db)
        .await?;

        let current_class = &parsed.classes[0];
        
        let input_choice = get_choice("(u)pload or (g)enerate the first class? ", &["u", "g"])?;
        let mut response_text = String::new();

        if input_choice == "g" {
            let class_message = format!(
                r#"
                Age: {}
                Student Level: {}
                Student Notes: {:?}

                Class Name: {}
                Methods: {:?}
                Stretch Methods: {:?}
                Description: {}
                This is the first class for the student.
                "#,
                age, parsed.current_level, parsed.notes,
                current_class.name, current_class.methods, 
                current_class.stretch_methods, current_class.description
            );
            println!("{}", class_message);

            let mut teacher_notes = String::new();
            get_response("Teacher notes", &mut teacher_notes)?;

            let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
            let mut client = HackClubClient::new(api_key)
                .with_system(CLASSNOTESGPT_PROMPT);

            response_text = client.send_message(&format!(
                "{}\nTeacher notes:\n{}", class_message, teacher_notes
            )).await?;
        } else {
            io::stdin().read_to_string(&mut response_text)?;
        }

        // Update classwork
        sqlx::query!(
            "UPDATE students_classes SET classwork = $1 WHERE class_id = $2",
            &response_text,
            lowest_class_id
        )
        .execute(&db)
        .await?;

        // Update student step
        sqlx::query!(
            "UPDATE students SET step = 2 WHERE id = $1",
            student_id
        )
        .execute(&db)
        .await?;
    }

    Ok(())
}

// ============ Continue Student Flow ============

async fn continue_student(db: sqlx::PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Fetch students
    let students = sqlx::query!(
        "SELECT name, id, step FROM students"
    )
    .fetch_all(&db)
    .await?;

    // Display students and choose one
    let mut choice = None;
    while choice.is_none() {
        for (i, student) in students.iter().enumerate() {
            println!("{}: {}", i, student.name);
        }
        println!("Please choose a student from the list");
        
        let mut input = String::new();
        get_response(">", &mut input)?;
        
        match input.trim().parse::<usize>() {
            Ok(idx) if idx < students.len() => choice = Some(idx),
            _ => println!("Invalid choice"),
        }
    }
    
    let choice = choice.unwrap();
    let student = &students[choice];

    if student.step == 1 {
        println!("Re-optimizing curriculum for {}... ", student.name);

        // Fetch all student and class data
        let classes = sqlx::query!(
            r#"
            SELECT
                s.age,
                s.current_level,
                s.final_goal,
                s.notes,
                sc.name,
                sc.methods,
                sc.stretch_methods,
                sc.description,
                sc.classwork,
                sc.notes as sc_notes,
                sc.hw,
                sc.hw_notes,
                sc.status
            FROM students_classes sc
            JOIN students s ON s.id = sc.student_id
            WHERE sc.student_id = $1
            ORDER BY sc.class_id ASC
            "#,
            student.id
        )
        .fetch_all(&db)
        .await?;

        if classes.is_empty() {
            println!("No upcoming or assessment classes found");
            return Ok(());
        }

        // Build the message for the curriculum refinement prompt
        let mut curc_message = format!(
            r#"
            Age: {:?}
            Student Level: {:?}
            Student Notes: {:?}
            "#,
            classes[0].age, classes[0].current_level, classes[0].notes
        );

        for class in &classes {
            curc_message.push_str(&format!(
                r#"
            ===========================

            Class Name: {}
            Methods: {:?}
            Stretch Methods: {:?}
            Description: {}
            Teacher notes: {:?}
            Teacher notes on homework: {:?}
            "#,
                class.name, class.methods, class.stretch_methods, 
                class.description, class.sc_notes, class.hw_notes
            ));
        }

        print_with_pager(&curc_message);

        println!("Enter any notes on the last hw (Ctrl+D when done): ");
        let mut last_hw_notes = String::new();
        io::stdin().read_to_string(&mut last_hw_notes)?;
        println!("Done reading.");

        curc_message.push_str(&format!("\n\nLast homework notes: {}", last_hw_notes));

        // Ask whether to plan or go unplanned
        let plan_choice = get_choice("\nPlan future classes or leave next class unplanned? (p)lan / (u)nplanned: ", &["p", "u"])?;

        // ---------- Obtain a Curriculum (always with at least one class) ----------
        let mut curriculum_response = if plan_choice == "u" {
            println!("Setting up unplanned exploration class...");
            let now = OffsetDateTime::now_utc();
            let class_name = format!("Exploration Class (Generated at: {})", now);
            // final_goal is non-null in the database
            let final_goal = classes[0].final_goal.clone();
            Curriculum {
                current_level: classes[0].current_level.clone(),
                final_goal,
                classes: vec![webapp::Class {
                    name: class_name,
                    methods: vec![],
                    stretch_methods: None,
                    description: "Student-led exploration session".to_string(),
                    relevance: None,
                    skills_tested: None,
                    status: None,
                }],
                future_concepts: vec![],
                notes: Some("Unplanned exploration session".to_string()),
                has_planned_classes: Some(false),
            }
        } else {
            let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
            let mut client = HackClubClient::new(api_key)
                .with_system(CURCGPT_REFINER_PROMPT);
            client.send_message_json(&curc_message, &Curriculum {
                current_level: String::new(),
                final_goal: String::new(),
                classes: Vec::new(),
                future_concepts: Vec::new(),
                notes: None,
                has_planned_classes: None,
            }).await?
        };

        // If the API returned no classes (planned but empty), add a dummy class too
        if curriculum_response.classes.is_empty() {
            let now = OffsetDateTime::now_utc();
            let class_name = format!("Exploration Class (Generated at: {})", now);
            curriculum_response.classes.push(webapp::Class {
                name: class_name,
                methods: vec![],
                stretch_methods: None,
                description: "Student-led exploration session".to_string(),
                relevance: None,
                skills_tested: None,
                status: None,
            });
            curriculum_response.has_planned_classes = Some(false);
        }

        // Update student info
        sqlx::query!(
            r#"
            UPDATE students
            SET current_level = $1,
                final_goal = $2,
                future_concepts = $3,
                notes = $4
            WHERE id = $5
            "#,
            &curriculum_response.current_level,
            &curriculum_response.final_goal,
            &curriculum_response.future_concepts,
            curriculum_response.notes.as_deref().unwrap_or(""),
            student.id
        )
        .execute(&db)
        .await?;

        // Mark the completed class (the one the student just finished)
        sqlx::query!(
            r#"
            UPDATE students_classes
            SET hw_notes = $1,
                status = 'completed'
            WHERE class_id = (
                SELECT current_class
                FROM students
                WHERE id = $2
            )
            "#,
            &last_hw_notes,
            student.id
        )
        .execute(&db)
        .await?;

        // Delete all upcoming classes (they will be replaced)
        sqlx::query!(
            "DELETE FROM students_classes WHERE student_id = $1 AND status = 'upcoming'",
            student.id
        )
        .execute(&db)
        .await?;

        // Insert the new upcoming classes from the curriculum
        let mut class_ids = Vec::new();
        for class in &curriculum_response.classes {
            let row = sqlx::query!(
                r#"
                INSERT INTO students_classes
                (student_id, status, name, methods, stretch_methods, description)
                VALUES ($1, 'upcoming', $2, $3, $4, $5)
                RETURNING class_id
                "#,
                student.id,
                &class.name,
                &class.methods,
                &class.stretch_methods.clone().unwrap_or_default(),
                &class.description
            )
            .fetch_one(&db)
            .await?;
            class_ids.push(row.class_id);
        }

        // Set the current_class to the first upcoming class (lowest class_id)
        if let Some(&lowest_class_id) = class_ids.iter().min() {
            sqlx::query!(
                "UPDATE students SET current_class = $1 WHERE id = $2",
                lowest_class_id,
                student.id
            )
            .execute(&db)
            .await?;
        } else {
            eprintln!("No classes inserted – something went wrong!");
            return Ok(());
        }

        // ---------- Generate class notes for the first upcoming class ----------
        let input_choice = get_choice(
            "(A)ssessment, 10-(m)inute warm up, (u)pload assignment, (g)enerate, (n)one, or (q)uit: ",
            &["a", "m", "u", "g", "n", "q"]
        )?;

        if input_choice == "u" {
            let mut classwork = String::new();
            io::stdin().read_to_string(&mut classwork)?;
            
            sqlx::query!(
                r#"
                UPDATE students_classes
                SET classwork = $1,
                    status = 'completed'
                WHERE class_id = $2
                "#,
                &classwork,
                class_ids[0]
            )
            .execute(&db)
            .await?;
        } else if input_choice == "q" {
            return Ok(());
        } else if input_choice == "n" {
            println!("No class notes this time");
        } else {
            println!("Generating class notes for {}", student.name);

            // Get the details of the first upcoming class
            let first_class = &curriculum_response.classes[0];

            let message = format!(
                r#"
                Age: {:?}
                Student Level: {:?}
                Student Notes: {:?}

                Class Name: {}
                Methods: {:?}
                Description: {}
                "#,
                classes[0].age, classes[0].current_level, classes[0].notes,
                first_class.name, first_class.methods, first_class.description
            );

            println!("{}", message);

            let mut teacher_notes = String::new();
            get_response(">", &mut teacher_notes)?;

            let prompt = match input_choice.as_str() {
                "a" => ASSESSMENTGPT_PROMPT,
                "m" => CLASSNOTESGPT_PROMPT,
                _ => CLASSNOTESGPT_PROMPT,
            };

            let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
            let mut client = HackClubClient::new(api_key.clone())
                .with_system(prompt);

            let mut response_text = client.send_message(&format!(
                "{}\nTeacher notes:\n{}", message, teacher_notes
            )).await?;

            if input_choice == "m" {
                // For warmup, we need another call
                let mut client = HackClubClient::new(api_key.clone())
                    .with_system(CLASSNOTESGPT_PROMPT);
                let response2 = client.send_message(&format!(
                    "{}\nTeacher notes:\n{}", message, teacher_notes
                )).await?;
                response_text.push_str(&response2);
            }

            // Update the classwork and mark as completed
            sqlx::query!(
                r#"
                UPDATE students_classes
                SET classwork = $1,
                    status = 'completed'
                WHERE class_id = $2
                "#,
                &response_text,
                class_ids[0]
            )
            .execute(&db)
            .await?;
        }

        // Move to the next step (homework generation)
        sqlx::query!(
            "UPDATE students SET step = 2 WHERE id = $1",
            student.id
        )
        .execute(&db)
        .await?;

    } else if student.step == 2 {
        // ---------- Homework generation (unchanged) ----------
        println!("Generating homework for {}", student.name);

        let current_class = sqlx::query!(
            r#"
            SELECT
                s.age,
                s.current_level,
                s.notes,
                sc.name,
                sc.description,
                sc.methods,
                sc.stretch_methods,
                sc.class_id,
                sc.classwork,
                s.name as student_name
            FROM students_classes sc
            JOIN students s ON s.id = sc.student_id
            WHERE sc.class_id = (
                SELECT current_class
                FROM students
                WHERE id = $1
            )
            "#,
            student.id
        )
        .fetch_one(&db)
        .await?;

        // Check for existing analysis
        let existing = sqlx::query!(
            "SELECT notes, taught_methods, needs_practice FROM students_classes WHERE class_id = $1",
            current_class.class_id
        )
        .fetch_optional(&db)
        .await?;

        let mut use_existing = false;
        if let Some(ref existing_row) = existing {
            if existing_row.notes.is_some() || existing_row.taught_methods.is_some() || existing_row.needs_practice.is_some() {
                println!("Found existing class analysis in database.");
                if yes_no!("Use existing analysis?", false) {
                    use_existing = true;
                }
            }
        }

        let completed_response: CompletedClass = if use_existing {
            CompletedClass {
                notes: existing.as_ref().unwrap().notes.clone(),
                taught_methods: existing.as_ref().unwrap().taught_methods.clone(),
                needs_practice: existing.as_ref().unwrap().needs_practice.clone(),
            }
        } else {
            let classwork_text = current_class.classwork.unwrap_or_default();
            
            let message = format!(
                r#"
                Age: {:?}
                Student Level: {:?}
                Student Notes: {:?}

                Class Name: {}
                Description: {}
                Methods (planned): {:?}
                Stretch Methods (planned): {:?}

                Classwork/Notes from class:

                {}
                "#,
                current_class.age, current_class.current_level, current_class.notes,
                current_class.name, current_class.description,
                current_class.methods, current_class.stretch_methods,
                classwork_text
            );
            println!("{}", message);

            println!("How did they do in class? What did you actually teach? (Ctrl + D to finish)");
            let mut first_msg = String::new();
            io::stdin().read_to_string(&mut first_msg)?;
            first_msg.push_str("\n\nBased on the classwork above and these teacher notes, output valid JSON for what was actually taught.");

            let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
            let mut client = HackClubClient::new(api_key)
                .with_system(CLASSANALYSIS_PROMPT);

            client.send_message_json(&format!("{}\n{}", message, first_msg), &CompletedClass {
                notes: None,
                taught_methods: None,
                needs_practice: None,
            }).await?
        };

        // Ask about homework
        let hw_prompt = if current_class.methods.is_empty() {
            "Generate homework based on what was taught? (y/n): "
        } else {
            "Generate homework? (y/n): "
        };
        
        if yes_no!(hw_prompt, true) {
            let message = format!(
                r#"
                Age: {:?}
                Student Level: {:?}
                Student Notes: {:?}

                Class Name: {}
                Notes on Class: {:?}
                Taught Methods (what student learned): {:?}
                Needs Practice: {:?}
                "#,
                current_class.age, current_class.current_level, current_class.notes,
                current_class.name, completed_response.notes,
                completed_response.taught_methods, completed_response.needs_practice
            );

            let hw_choice = get_choice("(u)pload assignment, (5) day, or (c)reative generated: ", &["u", "5", "c"])?;

            let mut response_text = String::new();
            if hw_choice == "u" {
                io::stdin().read_to_string(&mut response_text)?;
            } else {
                let prompt = if hw_choice == "5" { HWGPT_PROMPT } else { CREATIVE_HWGPT_PROMPT };
                
                print_with_pager(&format!("{}\n\n{}", prompt, message));

                let api_key = env::var("HACKCLUB_API_KEY").expect("HACKCLUB_API_KEY not set");
                let mut client = HackClubClient::new(api_key)
                    .with_system(prompt);
                response_text = client.send_message(&message).await?;
            }

            // Update database
            sqlx::query!(
                r#"
                UPDATE students_classes
                SET notes = $1,
                    taught_methods = $2,
                    needs_practice = $3,
                    hw = $4
                WHERE class_id = (
                    SELECT current_class
                    FROM students
                    WHERE id = $5
                )
                "#,
                completed_response.notes.as_deref().unwrap_or(""),
                &completed_response.taught_methods.clone().unwrap_or_default(),
                &completed_response.needs_practice.clone().unwrap_or_default(),
                &response_text,
                student.id
            )
            .execute(&db)
            .await?;

            println!("Done. Sending email to student's accounts...");

            // Get account IDs
            let account_row = sqlx::query!(
                r#"
                UPDATE students
                SET step = 1,
                    sent_email = false
                WHERE id = $1
                RETURNING account_id
                "#,
                student.id
            )
            .fetch_one(&db)
            .await?;

            if let Some(account_ids) = account_row.account_id {
                let accounts = sqlx::query!(
                    "SELECT name, email FROM accounts WHERE id = ANY($1)",
                    &account_ids
                )
                .fetch_all(&db)
                .await?;

                let app_base_url = env::var("APP_BASE_URL")
                    .unwrap_or_else(|_| "https://app.codeabode.co".to_string());
                let homework_url = format!(
                    "{}/work/?c={}&t=hw&s={}",
                    app_base_url, current_class.class_id, student.id
                );

                // Format a list of strings as bullet points
                let format_list = |list: &[String]| -> String {
                    if list.is_empty() {
                        "None".to_string()
                    } else {
                        format!("- {}", list.join("\n- "))
                    }
                };

                // Methods intended to be taught (non‑optional)
                let methods_str = format_list(&current_class.methods);

                // Stretch methods (optional)
                let stretch_str = match &current_class.stretch_methods {
                    Some(list) => format_list(list),
                    None => "None".to_string(),
                };

                // Taught methods (optional)
                let taught_str = match &completed_response.taught_methods {
                    Some(list) => format_list(list),
                    None => "None".to_string(),
                };

                // Needs practice (optional)
                let needs_str = match &completed_response.needs_practice {
                    Some(list) => format_list(list),
                    None => "None".to_string(),
                };

                let description = &current_class.description;

                let mut all_sent = true;

                for account in accounts {
                    if let Some(email) = account.email {
                        let body = format!(
                            "Hi {},\n\n\
                             Your son/daughter completed the {} class. Homework is available at:\n\
                             {}\n\n\
                             Methods taught:\n\
                             {}\n\n\
                             What needs practice:\n\
                             {}\n\n\
                             Class Description:\n\
                             {}\n\n\
                             Methods intended to be taught:\n\
                             {}\n\n\
                             Stretch Methods:\n\
                             {}\n\n\
                             If you have any questions/comments, feel free to reply to this email.\n\
                             Codeabode Team",
                            account.name,
                            current_class.name,
                            homework_url,
                            taught_str,
                            needs_str,
                            description,
                            methods_str,
                            stretch_str
                        );

                        let subject = format!("Homework for {}", current_class.name);

                        match send_email(&account.name, &email, &subject, &body).await {
                            Ok(_) => {
                                println!("✅ Email sent to {} <{}>", account.name, email);
                            }
                            Err(e) => {
                                eprintln!(
                                    "❌ Failed to send email to {} <{}>: {}",
                                    account.name, email, e
                                );
                                all_sent = false;
                            }
                        }
                    }
                }

                if all_sent {
                    sqlx::query!(
                        "UPDATE students SET sent_email = true WHERE id = $1",
                        student.id
                    )
                    .execute(&db)
                    .await?;
                    println!("All emails sent.");
                } else {
                    println!("Some emails failed to send. sent_email remains false – you may retry later.");
                }
            }
        } else {
            println!("Skipping homework generation");
            sqlx::query!(
                r#"
                UPDATE students
                SET step = 1,
                    sent_email = false
                WHERE id = $1
                "#,
                student.id
            )
            .execute(&db)
            .await?;
        }
    }

    Ok(())
}

// ============ User Management Functions ============

async fn add_user(
    db: sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut username = String::new();
    get_response("Enter unique username", &mut username)?;

    let mut name = String::new();
    get_response("Enter name", &mut name)?;

    let mut password = String::new();
    get_response("Enter password", &mut password)?;

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
        email
    )
    .fetch_one(&db)
    .await {
        Ok(row) => {
            println!("User created with id: {}", row.id);

            let students = sqlx::query!(
                "SELECT id, name FROM students"
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

            if yes_no!("Would you like to add a student?", false) && !students.is_empty() {
                loop {
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
        "SELECT id, username FROM accounts"
    )
    .fetch_all(&db)
    .await?;

    for (i, student) in students.iter().enumerate() {
        println!("({}) {}: {}", i, student.id, student.username);
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
    let users = sqlx::query!(
        "SELECT id, username, name FROM accounts ORDER BY id"
    )
    .fetch_all(&db)
    .await?;

    if users.is_empty() {
        println!("No users found.");
        return Ok(());
    }

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
    let users = sqlx::query!(
        "SELECT id, username, name, email FROM accounts ORDER BY id"
    )
    .fetch_all(&db)
    .await?;

    if users.is_empty() {
        println!("No users found in the database.");
        return Ok(());
    }

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

    let selected_user = users.iter().find(|u| u.id == user_id);

    match selected_user {
        Some(user) => {
            println!("\nEditing user: {} (ID: {})", user.username, user.id);

            match &user.email {
                Some(email) => println!("Current email: {}", email),
                None => println!("Current email: (not set)"),
            }

            if yes_no!("Do you want to change the email?", false) {
                println!("\nOptions:");
                println!("1. Set new email");
                println!("2. Clear email (set to NULL)");
                println!("3. Cancel");

                let mut option_input = String::new();
                get_response("Enter option number", &mut option_input)?;

                match option_input.trim() {
                    "1" => {
                        let mut new_email = String::new();
                        get_response("Enter new email address", &mut new_email)?;

                        let email_trimmed = new_email.trim();

                        if email_trimmed.is_empty() {
                            println!("Email cannot be empty. Use option 2 to clear email instead.");
                            return Ok(());
                        }

                        match sqlx::query!(
                            "UPDATE accounts SET email = $1 WHERE id = $2 RETURNING id, email",
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
                        if yes_no!("Are you sure you want to clear the email?", false) {
                            match sqlx::query!(
                                "UPDATE accounts SET email = NULL WHERE id = $1 RETURNING id, email",
                                user.id
                            )
                            .fetch_one(&db)
                            .await {
                                Ok(_) => println!("✅ Email cleared successfully."),
                                Err(e) => {
                                    eprintln!("❌ Error clearing email: {}", e);
                                    return Err(Box::new(e));
                                }
                            }
                        } else {
                            println!("Operation cancelled.");
                        }
                    }
                    "3" => println!("Operation cancelled."),
                    _ => println!("Invalid option selected."),
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
