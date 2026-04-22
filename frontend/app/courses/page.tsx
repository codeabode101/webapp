'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';

interface CourseItem {
  name: string;
  description: string;
  content: string;
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<{ python: CourseItem[]; javascript: CourseItem[] } | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses`)
      .then(res => res.json())
      .then(data => {
        console.log('Courses data:', data);
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
        <div className="classes-list">
          {course.map((cls, idx) => (
            <div key={cls.name} className="class-card">
              <button
                className="class-button"
                onClick={() => toggleClass(cls.name)}
              >
                <span className="class-number">{idx + 1}.</span>
                {cls.name}
                <span className="expand-icon">{expandedClass === cls.name ? '−' : '+'}</span>
              </button>
              <p className="class-description">{cls.description}</p>
              {expandedClass === cls.name && (
                <div className="class-content">
                  {isPaid || user ? (
                    <div className="content-text">{cls.content}</div>
                  ) : (
                    <div className="locked-content">
                      🔒 This content is available for logged-in students only.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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
      <h1>Courses</h1>
      
      {courses && (
        <>
          {renderCourse('python')}
          {renderCourse('javascript')}
        </>
      )}

      <style jsx>{`
        .page-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #fafafa;
          min-height: 100vh;
        }
        h1 {
          text-align: center;
          color: #1a1a1a;
          margin-bottom: 30px;
          font-size: 2rem;
        }
        .course-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .course-section h2 {
          color: #333;
          margin-bottom: 20px;
          font-size: 1.5rem;
          border-bottom: 2px solid #eee;
          padding-bottom: 12px;
        }
        .classes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .class-card {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e5e5e5;
        }
        .class-button {
          width: 100%;
          padding: 16px 20px;
          background: #fafafa;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1rem;
          font-weight: 600;
          color: #333;
          text-align: left;
          transition: background 0.2s;
        }
        .class-button:hover {
          background: #f0f0f0;
        }
        .class-number {
          color: #666;
          font-weight: normal;
          min-width: 24px;
        }
        .expand-icon {
          margin-left: auto;
          color: #666;
          font-size: 1.2rem;
          line-height: 1;
        }
        .class-description {
          padding: 0 20px 16px;
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }
        .class-content {
          padding: 20px;
          background: #f5f5f5;
          border-top: 1px solid #e5e5e5;
        }
        .content-text {
          line-height: 1.7;
          color: #333;
        }
        .locked-content {
          color: #666;
          font-style: italic;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
      `}</style>
    </div>
  );
}