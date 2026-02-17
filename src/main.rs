use std::env;
use std::sync::Arc;

use axum::{
    extract::{Json, Path}, 
    routing::{get, post}, 
    http::StatusCode, 
    Router};
use axum_extra::extract::cookie::{CookieJar, Cookie, SameSite};
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use sqlx::{
    postgres::PgPoolOptions,
    types::{Json as SqlxJson, time::OffsetDateTime},
};
use time::{
    Duration,
    serde::iso8601,
};
use tokio::net::{TcpListener, UnixListener}; 
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[derive(Serialize)]
struct StudentClass {
    class_id: i32,
    status: Arc<str>,
    name: Arc<str>,
    methods: Vec<String>,
    stretch_methods: Option<Vec<String>>,
    description: Arc<str>,
    classwork: Option<String>,
    notes: Option<String>,
    hw: Option<String>,
    hw_notes: Option<String>,
    classwork_submission: Option<String>,
    homework_submission: Option<String>
}

#[derive(Serialize)]
struct Student {
    id: i32,
    name: Arc<str>,
    age: i32,
    current_level: Arc<str>,
    final_goal: Arc<str>,
    future_concepts: Vec<String>,
    notes: Option<String>,
    classes: Vec<StudentClass>,
    current_class: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct ResetPasswordRequest {
    username: String,
    password: String,
    new_password: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct WorkRequest {
    class_id: i32,
    work: String,
}

#[derive(Debug, Serialize)]
struct StudentInfo {
    id: i32,
    name: String,
}

#[derive(Debug, Deserialize)]
struct QuestionRequest {
    work_type: String, // classwork or homework, it'll just pull the latest from the database and
    class_id: i32,
    error: String,
    interpretation: String,
    question: String,
}

#[derive(Debug, Deserialize)]
struct CommentRequest {
    question_id: i32,
    comment: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct Comment {
    id: i32,
    account_name: Option<String>,
    comment: String,
    #[serde(with = "iso8601")]
    created_at: OffsetDateTime,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct QuestionWithComments {
    id: i32,
    student_name: String,
    error: Option<String>,
    interpretation: Option<String>,
    work: Option<String>,
    question: String,
    #[serde(with = "iso8601")]
    created_at: OffsetDateTime,
    comments: SqlxJson<Vec<Comment>>, // wraps the Vec so it can be decoded from JSON
}

#[axum::debug_handler]
async fn reset_password(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    jar: CookieJar,
    Json(body): Json<ResetPasswordRequest>,
) -> (StatusCode, CookieJar, String) {
    // Create cookies with the same attributes as when they were set
    let token_cookie = Cookie::build(("token", ""))
        .path("/")
        .max_age(Duration::seconds(0)) // Expire immediately
        .http_only(true)
        .same_site(SameSite::Strict);
    
    let name_cookie = Cookie::build(("name", ""))
        .path("/")
        .max_age(Duration::seconds(0)) // Expire immediately
        .same_site(SameSite::Strict);
    
    // Remove both cookies
    let new_jar = jar.clone()
        .remove(token_cookie)
        .remove(name_cookie);

    match sqlx::query!(
        "UPDATE accounts 
        SET password = digest($1, 'sha512') 
        WHERE username = $2 AND password = digest($3, 'sha512')
        RETURNING id",
        body.new_password,
        body.username,
        body.password
    )
    .fetch_optional(&**state).await {
        Ok(Some(row)) => {
            match sqlx::query!(
                "UPDATE tokens
                SET expires_at = now() 
                WHERE user_id = $1 AND
                expires_at > now()",
                row.id
            )
            .execute(&**state).await {
                Ok(deleted_tokens) => (StatusCode::OK, new_jar, 
                    format!("Password reset successfully: {} tokens cleared", 
                    deleted_tokens.rows_affected())),
                Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, jar, e.to_string())
            }
        },
        Ok(None) => {
            (StatusCode::UNAUTHORIZED, new_jar, "Incorrect password".to_string())
        },
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, jar, e.to_string())
        }
    } 
}

#[axum::debug_handler]
async fn login(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    jar: CookieJar,
    Json(body): Json<LoginRequest>,
) -> Result<(CookieJar, String), (StatusCode, String)> {
    match sqlx::query!(
        r#"
        INSERT INTO tokens (user_id)
        SELECT id 
        FROM accounts 
        WHERE username = $1 
        AND password = digest($2, 'sha512')
        RETURNING 
            token, 
            (SELECT name FROM accounts WHERE id = tokens.user_id) as name
        "#,
        body.username,
        body.password
    )
    .fetch_optional(&**state)  // Use fetch_optional since we might get 0 or 1 row
    .await
    {
        Ok(Some(row)) => {
            Ok((
                jar
                  .add(
                      Cookie::build(("name", row.name.unwrap()))
                        .same_site(SameSite::Strict)
                        .max_age(Duration::days(15))
                        .path("/")
                  )
                  .add(
                      Cookie::build(("token", row.token))
                        .http_only(true)
                        .same_site(SameSite::Strict)
                        .max_age(Duration::days(15))
                        .path("/")
                  ),
                "Login successful".to_string(),
            ))
        },
        Ok(None) => {
            Err((
                StatusCode::UNAUTHORIZED,
                "Incorrect password".to_string()
            ))
        },
        Err(e) => {
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                e.to_string() 
            ))
        },
    }
}

#[axum::debug_handler]
async fn list_students(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    cookie_jar: CookieJar,
) -> Result<Json<Vec<StudentInfo>>, (StatusCode, CookieJar, String)> {
    // Try to get the token
    let token = match cookie_jar.get("token") {
        Some(token) => token,
        None => return Err((StatusCode::UNAUTHORIZED, cookie_jar, "No token provided".to_string())),
    };

    // Execute the query
    match sqlx::query_as!(
        StudentInfo,
        "SELECT id, name
        FROM students 
        WHERE (
            SELECT user_id 
            FROM tokens 
            WHERE token = $1
                AND expires_at > now()
        ) = ANY(account_id)",
        token.value()
    )
    .fetch_all(&**state).await {
        Ok(rows) => Ok(Json(rows)),
        Err(e) => {
            // Remove cookies on error
            let updated_cookie_jar = cookie_jar.remove("token").remove("name");
            Err((StatusCode::UNAUTHORIZED, updated_cookie_jar, 
                 format!("Invalid token or database error: {}", e)))
        },
    }
}

#[axum::debug_handler]
async fn get_student(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    cookie_jar: CookieJar,
    Path(id): Path<i32>,
) -> Result<String, StatusCode> {
    match sqlx::query!(
        "SELECT 
            name, age, current_level, final_goal, 
            future_concepts, notes, current_class
        FROM students 
        WHERE (
            SELECT user_id 
            FROM tokens 
            WHERE token = $1
                AND expires_at > now()
        ) = ANY(account_id) AND id = $2",
        cookie_jar.get("token").ok_or(StatusCode::NOT_FOUND)?.value(),
        id
    ).fetch_optional(&**state).await {
        Ok(Some(row)) => {
            // fetch the classes:
            let classes = sqlx::query_as!(
                StudentClass,
                "SELECT sc.class_id, sc.status, sc.name, sc.methods, sc.stretch_methods,
                sc.description, sc.classwork, sc.notes, sc.hw, sc.hw_notes,
                (
                    SELECT work 
                    FROM submissions s
                    WHERE s.class_id = sc.class_id 
                    AND s.work_type = 'classwork'
                    ORDER BY s.id DESC 
                    LIMIT 1
                ) as classwork_submission,
                (
                    SELECT work  
                    FROM submissions s
                    WHERE s.class_id = sc.class_id 
                    AND s.work_type = 'homework'
                    ORDER BY s.id DESC 
                    LIMIT 1
                ) as homework_submission
                FROM students_classes sc
                WHERE sc.student_id = $1
                ORDER BY sc.class_id DESC",
                id
            )
            .fetch_all(&**state)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let student = Student {
                id,
                name: row.name.into(),
                age: row.age,
                current_level: row.current_level.into(),
                final_goal: row.final_goal.into(),
                future_concepts: row.future_concepts.into(),
                notes: row.notes.into(),
                current_class: row.current_class,
                classes,
            };
            Ok(serde_json::to_string(&student).unwrap())
        },
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[axum::debug_handler]
async fn submit_work(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    cookie_jar: CookieJar,
    Path(work_type): Path<String>,
    Json(body): Json<WorkRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    match sqlx::query!(
        "WITH token_user AS (
            SELECT user_id
            FROM tokens
            WHERE token = $2 AND expires_at > now()
        ),
        authorized AS (
            SELECT sc.class_id
            FROM students_classes sc
            JOIN students s ON s.id = sc.student_id
            WHERE sc.class_id = $3
              AND (SELECT user_id FROM token_user) = ANY(s.account_id)
        )
        INSERT INTO submissions (work, work_type, account_id, class_id)
        SELECT $1, $4, (SELECT user_id FROM token_user), $3
        WHERE EXISTS (SELECT 1 FROM authorized)",

        body.work,
        cookie_jar.get("token").ok_or(
            (StatusCode::NOT_FOUND, "Token not found".to_string()))?.value(),
        body.class_id,
        work_type,
    ).execute(&**state).await {
        Ok(rows) => { 
            if rows.rows_affected() <= 0 {
                Err((StatusCode::UNAUTHORIZED, "Something went wrong.".to_string()))
            } else {
                Ok(StatusCode::OK)
            } 
        },
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    }
}

#[axum::debug_handler]
async fn submit_question(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    cookie_jar: CookieJar,
    Json(body): Json<QuestionRequest>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    match sqlx::query!(
        r#"
        WITH token_user AS (
            SELECT user_id
            FROM tokens
            WHERE token = $1 AND expires_at > now()
        )
        INSERT INTO questions (account_id, submission_id, error, interpretation, question)
        SELECT
            token_user.user_id,
            sub.id,
            $4, $5, $6
        FROM token_user
        LEFT JOIN LATERAL (
            SELECT s.id
            FROM submissions s
            JOIN students_classes sc ON sc.class_id = s.class_id
            WHERE s.work_type = $3
            ORDER BY s.id DESC
            LIMIT 1
        ) sub ON true
        WHERE EXISTS (
            SELECT 1
            FROM students
            WHERE id = (
                SELECT student_id 
                FROM students_classes 
                WHERE class_id = $2
            ) 
            AND token_user.user_id = ANY(account_id)
        )        
        RETURNING created_at
        "#,
        cookie_jar.get("token").ok_or(
            (StatusCode::NOT_FOUND, "Token not found".to_string()))?.value(),
        body.class_id,
        body.work_type,
        body.error,
        body.interpretation,
        body.question,
    ).fetch_optional(&**state).await {
        Ok(Some(rows)) => Ok((StatusCode::OK, format!("{}", rows.created_at))), 
        Ok(None) => Err((StatusCode::NOT_FOUND, "Something went wrong.".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    }
} 


#[axum::debug_handler]
async fn submit_comment(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    cookie_jar: CookieJar,
    Json(body): Json<CommentRequest>,
) -> Result<(StatusCode, String), (StatusCode, String)> {
    match sqlx::query!(
        r#"
        WITH token_user AS (
            SELECT user_id
            FROM tokens
            WHERE token = $1 AND expires_at > now()
        )
        INSERT INTO comments (account_id, question_id, comment)
        SELECT
            token_user.user_id,
            $2,
            $3
        FROM token_user
        RETURNING created_at
        "#,
        cookie_jar.get("token").ok_or(
            (StatusCode::NOT_FOUND, "Token not found".to_string()))?.value(),
        body.question_id,
        body.comment,
    ).fetch_optional(&**state).await {
        Ok(Some(rows)) => Ok((StatusCode::OK, format!("{}", rows.created_at))),
        Ok(None) => Err((StatusCode::UNAUTHORIZED, "Something went wrong.".to_string())),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    }
} 

#[axum::debug_handler]
async fn get_questions(
    state: axum::extract::State<Arc<sqlx::PgPool>>,
    jar: CookieJar,
) -> Result<Json<Vec<QuestionWithComments>>, (StatusCode, String)> {
    let token = jar
        .get("token")
        .ok_or((StatusCode::UNAUTHORIZED, "No token".to_string()))?
        .value()
        .to_string();

    let questions = sqlx::query_as!(
        QuestionWithComments,
        r#"
        SELECT 
            q.id,
            st.name AS "student_name!",
            q.error,
            q.interpretation,
            q.question,
            s.work AS "work?",                  
            (q.created_at AT TIME ZONE 'UTC') AS "created_at!",
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'account_name', a.name,
                            'comment', c.comment,
                            'created_at', (c.created_at AT TIME ZONE 'UTC')
                        ) ORDER BY c.created_at ASC
                    )
                    FROM comments c
                    LEFT JOIN accounts a ON a.id = c.account_id
                    WHERE c.question_id = q.id
                ), '[]'::json
            ) AS "comments!: SqlxJson<Vec<Comment>>"
        FROM questions q
        LEFT JOIN submissions s ON s.id = q.submission_id
        LEFT JOIN students_classes sc ON sc.class_id = s.class_id
        LEFT JOIN students st ON st.id = sc.student_id
        WHERE EXISTS (
            SELECT 1
            FROM tokens
            WHERE token = $1 AND expires_at > now()
        )
        ORDER BY q.created_at DESC
        "#,
        token,   // bind the token value
    )
    .fetch_all(&**state)
    .await
    .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;

    Ok(Json(questions))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let db = PgPoolOptions::new().connect(
        &env::var("DATABASE_URL").expect("DATABASE_URL must be set")
    ).await?;

    let shared_state = Arc::new(db);

    // Parse command-line arguments
    let args: Vec<String> = std::env::args().collect();
    let mut port = "8090".to_string();
    let mut unix_socket = None;

    let mut i = 1; // Skip program name
    while i < args.len() {
        if args[i] == "--unix" && i + 1 < args.len() {
            unix_socket = Some(args[i + 1].clone());
            i += 2; // Skip both --unix and the socket path
        } else {
            port = args[i].clone();
            i += 1;
        }
    }

    let app = Router::new()
        .route_service("/", ServeFile::new("frontend/out/index.html"))
        //.route_service("/style.css", ServeFile::new("/style.css"))
        .route("/api/reset-password", post(reset_password))
        .route("/api/login", post(login))
        .route("/api/list_students", post(list_students))
        .route("/api/get_student/{id}", post(get_student))
        .route("/api/submit/{type}", post(submit_work))
        .route("/api/ask", post(submit_question))
        .route("/api/comment", post(submit_comment))
        .route("/api/get_questions", get(get_questions))
        .fallback_service(ServeDir::new("frontend/out"))
        .with_state(shared_state)
        ;

    info!("Initialized routes");

    if let Some(socket_path) = unix_socket {
        // delete the file before binding
        tokio::fs::remove_file(&socket_path).await.ok();
        let listener = UnixListener::bind(&socket_path).unwrap();

        info!("Starting server on Unix socket: {}", socket_path);
        axum::serve(listener, app.into_make_service()).await?;

    } else {
        let listener = TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
        info!("Starting server on port {}", port);
        axum::serve(listener, app.into_make_service()).await?;
    }

    Ok(())
}
