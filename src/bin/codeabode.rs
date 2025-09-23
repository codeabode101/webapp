// this is meant to add a user to the database
use clap::Command;
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::{
    env,
    io::{self, Write},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let db_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let db = PgPoolOptions::new().connect(&db_url).await?;

    let matches = Command::new("codeabode")
        .subcommand(Command::new("add").about("Add a new user"))
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
        Some(("reset", _)) => reset_pswd(db).await?,
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

            // list all students that don't have an account
            let students = sqlx::query!(
                "SELECT id, name
                FROM students
                WHERE account_id IS NULL"
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
                            SET account_id = $1
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

fn get_response(question: &str, output: &mut String) 
-> Result<(), Box<dyn std::error::Error>> {
    print!("{}: ", question);
    io::stdout().flush()?;

    io::stdin().read_line(output)?;

    Ok(())
}
