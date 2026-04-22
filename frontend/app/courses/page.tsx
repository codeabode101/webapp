'use client';

import { useState, useEffect } from 'react';

export default function CoursesPage() {
  return (
    <div className="max-w-2xl mx-auto p-5 bg-gray-100 min-h-screen font-sans">
      <h1 className="text-3xl text-center mb-8 text-gray-900 font-bold">Courses</h1>
      <CoursesList />
    </div>
  );
}

function CoursesList() {
  const [courses, setCourses] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`)
      .then(res => res.json())
      .then(data => setCourses(data.courses))
      .catch(err => {
        console.error(err);
        setError('Failed to load');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-10 text-gray-600">Loading...</div>;
  if (error) return <div className="text-center p-10 text-red-600">{error}</div>;
  if (!courses) return <div className="text-center p-10 text-gray-600">No courses</div>;

  return (
    <>
      <CourseSection title="Python" titleColor="text-blue-700" items={courses.python} expanded={expanded} onToggle={setExpanded} />
      <CourseSection title="JavaScript" titleColor="text-yellow-600" items={courses.javascript} expanded={expanded} onToggle={setExpanded} />
    </>
  );
}

function CourseSection({ title, titleColor, items, expanded, onToggle }: any) {
  if (!items || !Array.isArray(items)) return null;
  return (
    <div className="mb-8">
      <h2 className={`text-2xl font-bold mb-4 ${titleColor}`}>{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((item: any, idx: number) => (
          <div key={item.name} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            <button 
              className="w-full p-5 bg-white hover:bg-gray-50 border-none cursor-pointer flex items-center gap-4 text-left transition"
              onClick={() => onToggle(expanded === item.name ? null : item.name)}
            >
              <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm flex-shrink-0">
                {idx + 1}
              </span>
              <span className="flex-1 text-lg font-semibold text-gray-800">{item.name}</span>
              <span className="text-xl text-gray-400 w-6 text-center">
                {expanded === item.name ? '−' : '+'}
              </span>
            </button>
            
            <div className="px-5 pb-4 bg-gray-50">
              <p className="text-gray-600 text-base">{item.description}</p>
            </div>
            
            {expanded === item.name && (
              <div className="p-5 bg-blue-50 border-t border-blue-100">
                <p className="leading-relaxed text-gray-700 text-base whitespace-pre-wrap">{item.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}