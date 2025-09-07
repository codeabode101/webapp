// this is meant to add a user to the database
use bcrypt::hash;
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

    let bcrypt_cost: u32 = env::var("BCRYPT_COST")
        .unwrap_or(String::from("10"))
        .parse()
        .unwrap_or(10);

    let mut username = String::new();
    get_response("Enter unique username", &mut username)?;

    let mut name = String::new();
    get_response("Enter name", &mut name)?;

    let mut password = String::new();
    get_response("Enter password", &mut password)?;

    let password_hash = hash(password.trim(), bcrypt_cost)?;

    match sqlx::query!(
        "INSERT INTO accounts 
        (username, name, password) 
        VALUES ($1, $2, digest($3, 'sha512'))
        RETURNING id",
        username.trim(),
        name.trim(),
        password_hash
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

fn get_response(question: &str, output: &mut String) 
-> Result<(), Box<dyn std::error::Error>> {
    print!("{}: ", question);
    io::stdout().flush()?;

    io::stdin().read_line(output)?;

    Ok(())
}
