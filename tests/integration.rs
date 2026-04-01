//! Integration tests for codeabode CLI
//! 
//! These tests require:
//! - A local PostgreSQL database named 'sigma'
//! - HACKCLUB_API_KEY environment variable
//! 
//! Run with: cargo test --test integration -- --nocapture

use sqlx::PgPool;
use dotenv::dotenv;

struct TestContext {
    db: PgPool,
    student_id: i32,
}

impl TestContext {
    async fn new(test_name: &str) -> Self {
        dotenv().ok();
        let db_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://localhost/sigma".to_string());
        let db = PgPool::connect(&db_url).await.unwrap();
        
        // Clean up any existing test students with this test's prefix
        let pattern = format!("Test Student {}%", test_name);
        sqlx::query!("DELETE FROM students WHERE name LIKE $1", pattern)
            .execute(&db)
            .await
            .unwrap();
        
        TestContext { db, student_id: 0 }
    }
    
    async fn create_student(&mut self, name: &str, age: i32) {
        let row = sqlx::query!(
            r#"
            INSERT INTO students (name, age, current_level, final_goal, future_concepts, step)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#,
            name,
            age,
            "Python basics",
            "Build games",
            &Vec::<String>::new() as &[String],
            1
        )
        .fetch_one(&self.db)
        .await
        .unwrap();
        self.student_id = row.id;
    }
    
    async fn create_class(&self, student_id: i32, name: &str, status: &str, methods: &[String]) -> i32 {
        let row = sqlx::query!(
            r#"
            INSERT INTO students_classes (student_id, status, name, methods, description)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING class_id
            "#,
            student_id,
            status,
            name,
            methods,
            "Test class"
        )
        .fetch_one(&self.db)
        .await
        .unwrap();
        row.class_id
    }
}

#[tokio::test]
async fn test_database_connection() {
    let ctx = TestContext::new("test").await;
    let result = sqlx::query!("SELECT 1 as test")
        .fetch_one(&ctx.db)
        .await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_create_and_cleanup_student() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Create", 12).await;
    
    // Verify student was created
    let student = sqlx::query!("SELECT id, name, age FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    
    assert_eq!(student.name, "Test Student Create");
    assert_eq!(student.age, 12);
    
    // Cleanup
    sqlx::query!("DELETE FROM students WHERE id = $1", ctx.student_id)
        .execute(&ctx.db)
        .await
        .unwrap();
}

#[tokio::test]
async fn test_create_class_with_no_methods() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student No Methods", 12).await;
    
    // Create class with empty methods (for unplanned sessions)
    let class_id = ctx.create_class(ctx.student_id, "Exploration Class", "upcoming", &[]).await;
    
    let class = sqlx::query!(
        "SELECT class_id, name, methods FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(class.name, "Exploration Class");
    assert!(class.methods.is_empty());
}

#[tokio::test]
async fn test_student_step_transitions() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Steps", 12).await;
    
    // Initial step should be 1
    let student = sqlx::query!("SELECT step FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    assert_eq!(student.step, 1);
    
    // Update to step 2
    sqlx::query!("UPDATE students SET step = 2 WHERE id = $1", ctx.student_id)
        .execute(&ctx.db)
        .await
        .unwrap();
    
    let student = sqlx::query!("SELECT step FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    assert_eq!(student.step, 2);
    
    // Back to step 1
    sqlx::query!("UPDATE students SET step = 1 WHERE id = $1", ctx.student_id)
        .execute(&ctx.db)
        .await
        .unwrap();
    
    let student = sqlx::query!("SELECT step FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    assert_eq!(student.step, 1);
}

#[tokio::test]
async fn test_class_status_transitions() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Status", 12).await;
    
    let methods = vec!["print()".to_string(), "input()".to_string()];
    let class_id = ctx.create_class(ctx.student_id, "Variables Class", "upcoming", &methods).await;
    
    // Verify initial status
    let class = sqlx::query!(
        "SELECT status FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    assert_eq!(class.status, "upcoming");
    
    // Update to completed
    sqlx::query!(
        "UPDATE students_classes SET status = 'completed' WHERE class_id = $1",
        class_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    let class = sqlx::query!(
        "SELECT status FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    assert_eq!(class.status, "completed");
}

#[tokio::test]
async fn test_taught_methods_storage() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Taught", 12).await;
    
    let methods = vec!["while loops".to_string(), "break".to_string()];
    let class_id = ctx.create_class(ctx.student_id, "Loops Class", "upcoming", &methods).await;
    
    // Update with what was actually taught
    let taught = vec!["while loops".to_string()];
    let needs_practice = vec!["break".to_string()];
    
    sqlx::query!(
        r#"
        UPDATE students_classes 
        SET taught_methods = $1, needs_practice = $2
        WHERE class_id = $3
        "#,
        &taught,
        &needs_practice,
        class_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    let class = sqlx::query!(
        "SELECT taught_methods, needs_practice FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(class.taught_methods, Some(taught));
    assert_eq!(class.needs_practice, Some(needs_practice));
}

#[tokio::test]
async fn test_unplanned_class_workflow() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Unplanned", 12).await;
    
    // Create unplanned class (no methods)
    let class_id = ctx.create_class(ctx.student_id, "Exploration", "upcoming", &[]).await;
    
    // Add classwork notes
    sqlx::query!(
        "UPDATE students_classes SET classwork = $1, status = 'completed' WHERE class_id = $2",
        "Student explored variables and practiced print statements",
        class_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    // Update with what was taught
    let taught = vec!["print()".to_string(), "variables".to_string()];
    sqlx::query!(
        "UPDATE students_classes SET taught_methods = $1 WHERE class_id = $2",
        &taught,
        class_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    // Verify
    let class = sqlx::query!(
        "SELECT name, methods, taught_methods, classwork FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(class.name, "Exploration");
    assert!(class.methods.is_empty()); // Planned methods empty
    assert_eq!(class.taught_methods, Some(taught)); // But we recorded what was taught
    assert!(class.classwork.is_some());
}

#[tokio::test]
async fn test_planned_class_workflow() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Planned", 12).await;
    
    // Create planned class with methods
    let methods = vec!["if".to_string(), "else".to_string(), "elif".to_string()];
    let class_id = ctx.create_class(ctx.student_id, "Conditionals", "upcoming", &methods).await;
    
    // Verify planned methods exist
    let class = sqlx::query!(
        "SELECT name, methods FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(class.methods, methods);
    assert_eq!(class.name, "Conditionals");
}

#[tokio::test]
async fn test_homework_generation_data() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student HW", 12).await;
    
    let methods = vec!["functions".to_string(), "return".to_string()];
    let class_id = ctx.create_class(ctx.student_id, "Functions", "upcoming", &methods).await;
    
    // Simulate completed class with analysis
    let taught = vec!["functions".to_string()];
    let needs_practice = vec!["return".to_string()];
    let notes = "Student understood functions but needs practice with return values";
    let hw = "5-day homework assignment on functions";
    
    sqlx::query!(
        r#"
        UPDATE students_classes 
        SET status = 'completed',
            taught_methods = $1,
            needs_practice = $2,
            notes = $3,
            hw = $4
        WHERE class_id = $5
        "#,
        &taught,
        &needs_practice,
        notes,
        hw,
        class_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    let class = sqlx::query!(
        "SELECT taught_methods, needs_practice, notes, hw FROM students_classes WHERE class_id = $1",
        class_id
    )
    .fetch_one(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(class.taught_methods, Some(taught));
    assert_eq!(class.needs_practice, Some(needs_practice));
    assert_eq!(class.notes, Some(notes.to_string()));
    assert_eq!(class.hw, Some(hw.to_string()));
}

#[tokio::test]
async fn test_student_current_class_updates() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Current", 12).await;
    
    // Create multiple classes
    let class1 = ctx.create_class(ctx.student_id, "Class 1", "upcoming", &[]).await;
    let class2 = ctx.create_class(ctx.student_id, "Class 2", "upcoming", &[]).await;
    
    // Set current_class to first class
    sqlx::query!("UPDATE students SET current_class = $1 WHERE id = $2", class1, ctx.student_id)
        .execute(&ctx.db)
        .await
        .unwrap();
    
    let student = sqlx::query!("SELECT current_class FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    assert_eq!(student.current_class, Some(class1));
    
    // Update to second class
    sqlx::query!("UPDATE students SET current_class = $1 WHERE id = $2", class2, ctx.student_id)
        .execute(&ctx.db)
        .await
        .unwrap();
    
    let student = sqlx::query!("SELECT current_class FROM students WHERE id = $1", ctx.student_id)
        .fetch_one(&ctx.db)
        .await
        .unwrap();
    assert_eq!(student.current_class, Some(class2));
}

#[tokio::test]
async fn test_delete_upcoming_classes() {
    let mut ctx = TestContext::new("test").await;
    ctx.create_student("Test Student Delete", 12).await;
    
    // Create mix of completed and upcoming classes
    ctx.create_class(ctx.student_id, "Completed", "completed", &[]).await;
    let upcoming1 = ctx.create_class(ctx.student_id, "Upcoming 1", "upcoming", &[]).await;
    let upcoming2 = ctx.create_class(ctx.student_id, "Upcoming 2", "upcoming", &[]).await;
    
    // Delete upcoming classes
    sqlx::query!(
        "DELETE FROM students_classes WHERE student_id = $1 AND status = 'upcoming'",
        ctx.student_id
    )
    .execute(&ctx.db)
    .await
    .unwrap();
    
    // Verify only completed remains
    let classes = sqlx::query!(
        "SELECT class_id, status FROM students_classes WHERE student_id = $1",
        ctx.student_id
    )
    .fetch_all(&ctx.db)
    .await
    .unwrap();
    
    assert_eq!(classes.len(), 1);
    assert_eq!(classes[0].status, "completed");
    assert_ne!(classes[0].class_id, upcoming1);
    assert_ne!(classes[0].class_id, upcoming2);
}
