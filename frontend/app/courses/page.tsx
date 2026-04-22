'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

interface ClassItem {
  name: string;
  description: string;
  content: string;
}

interface Week {
  week: number;
  classes: ClassItem[];
}

interface Course {
  week: number;
  classes: ClassItem[];
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<{ python: Course[]; javascript: Course[] } | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses`)
      .then(res => res.json())
      .then(data => {
        setCourses(data.courses);
        setIsPaid(data.isPaid);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleClass = (className: string) => {
    setExpandedClass(expandedClass === className ? null : className);
  };

  const renderCourse = (courseKey: 'python' | 'javascript') => {
    if (!courses) return null;
    const course = courses[courseKey];
    const lang = courseKey === 'python' ? 'Python' : 'JavaScript';

    return (
      <div className="course-section">
        <h2>{lang}</h2>
        {course.map((week: Week) => (
          <div key={week.week} className="week-section">
            <h3>Week {week.week}</h3>
            <div className="classes-grid">
              {week.classes.map((cls) => (
                <div key={cls.name} className="class-card">
                  <button
                    className="class-button"
                    onClick={() => toggleClass(cls.name)}
                  >
                    {cls.name}
                    <span className="expand-icon">{expandedClass === cls.name ? '▲' : '▼'}</span>
                  </button>
                  <p className="class-description">{cls.description}</p>
                  {expandedClass === cls.name && (
                    <div className="class-content">
                      {isPaid ? (
                        <p>{cls.content}</p>
                      ) : (
                        <p className="locked-content">
                          🔒 This content is available for paying students only. 
                          Contact your teacher to unlock full course access.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading courses...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <style jsx>{`
        .page-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, sans-serif;
        }
        h1 {
          text-align: center;
          margin-bottom: 30px;
        }
        .course-section {
          margin-bottom: 40px;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 12px;
        }
        .course-section h2 {
          color: #333;
          margin-bottom: 20px;
        }
        .week-section {
          margin-bottom: 20px;
        }
        .week-section h3 {
          color: #666;
          margin-bottom: 10px;
          padding-left: 10px;
          border-left: 3px solid #0070f3;
        }
        .classes-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .class-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }
        .class-button {
          width: 100%;
          padding: 15px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
          font-weight: 600;
          text-align: left;
          transition: background 0.2s;
        }
        .class-button:hover {
          background: #f5f5f5;
        }
        .expand-icon {
          color: #666;
        }
        .class-description {
          padding: 0 15px 15px;
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        .class-content {
          padding: 15px;
          background: #f0f0f0;
          border-top: 1px solid #ddd;
        }
        .class-content p {
          margin: 0;
          line-height: 1.6;
        }
        .locked-content {
          color: #666;
          font-style: italic;
          padding: 20px;
          text-align: center;
          background: #fff;
          border-radius: 8px;
          border: 2px dashed #ccc;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .login-prompt {
          text-align: center;
          padding: 20px;
          background: #fff3cd;
          border-radius: 8px;
          margin-bottom: 20px;
        }
      `}</style>

      <h1>Courses 📚</h1>
      
      {!user && (
        <div className="login-prompt">
          👆 Log in to see full course content!
        </div>
      )}

      {courses && (
        <>
          {renderCourse('python')}
          {renderCourse('javascript')}
        </>
      )}
    </div>
  );
}