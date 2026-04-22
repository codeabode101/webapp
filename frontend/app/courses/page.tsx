'use client';

import { useState, useEffect } from 'react';

export default function CoursesPage() {
  return (
    <div className="max-w-2xl mx-auto p-5 bg-gray-50 min-h-screen font-sans">
      <h1 className="text-2xl text-center mb-8 text-gray-800">Courses</h1>
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
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => setCourses(data.courses))
      .catch(err => {
        console.error(err);
        setError('Failed to load');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-10 text-gray-500">Loading...</div>;
  if (error) return <div className="text-center p-10 text-red-500">{error}</div>;
  if (!courses) return <div className="text-center p-10 text-gray-500">No courses</div>;

  return (
    <>
      <CourseSection title="Python" items={courses.python} expanded={expanded} onToggle={setExpanded} />
      <CourseSection title="JavaScript" items={courses.javascript} expanded={expanded} onToggle={setExpanded} />
    </>
  );
}

function CourseSection({ title, items, expanded, onToggle }: any) {
  if (!items || !Array.isArray(items)) return null;
  return (
    <div className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-xl text-gray-700 mb-5 pb-3 border-b-2 border-gray-200">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map((item: any, idx: number) => (
          <div key={item.name} className="border border-gray-200 rounded-lg overflow-hidden">
            <button 
              className="w-full p-4 bg-gray-50 hover:bg-gray-100 border-none cursor-pointer flex items-center gap-3 text-left font-semibold text-gray-700 transition"
              onClick={() => onToggle(expanded === item.name ? null : item.name)}
            >
              <span className="text-gray-400 font-normal w-6">{idx + 1}.</span>
              <span className="flex-1">{item.name}</span>
              <span className="text-gray-400">{expanded === item.name ? '−' : '+'}</span>
            </button>
            <p className="px-4 pb-4 text-sm text-gray-500">{item.description}</p>
            {expanded === item.name && (
              <div className="p-5 bg-gray-50 border-t border-gray-200">
                <p className="leading-relaxed text-gray-700">{item.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}