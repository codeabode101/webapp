'use client';

import { useState, useEffect } from 'react';

export default function CoursesPage() {
  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl text-center mb-8 font-bold">Courses</h1>
        <CoursesList />
      </div>
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

  if (loading) return <div className="text-center p-10" style={{color: '#8ea1b8'}}>Loading...</div>;
  if (error) return <div className="text-center p-10" style={{color: '#ff6a6a'}}>{error}</div>;
  if (!courses) return <div className="text-center p-10" style={{color: '#8ea1b8'}}>No courses</div>;

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
    <div className="mb-10">
      <h2 className="text-2xl font-bold mb-5" style={{color: '#26dcfc'}}>{title}</h2>
      <div className="flex flex-col gap-3">
        {items.map((item: any, idx: number) => (
          <div key={item.name} className="rounded-xl shadow-sm overflow-hidden" style={{backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(106,165,255,0.1)'}}>
            <button 
              className="w-full p-4 md:p-5 hover:rgba border-none cursor-pointer flex items-center gap-3 md:gap-4 text-left transition"
              style={{backgroundColor: 'transparent'}}
              onClick={() => onToggle(expanded === item.name ? null : item.name)}
            >
              <span className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm flex-shrink-0" style={{backgroundColor: 'rgba(106,165,255,0.15)', color: '#6af5ff'}}>
                {idx + 1}
              </span>
              <span className="flex-1 text-base md:text-lg font-semibold" style={{color: '#e8ecf2'}}>{item.name}</span>
              <span className="text-lg md:text-xl w-5 md:w-6 text-center" style={{color: '#6a9cd4'}}>
                {expanded === item.name ? '−' : '+'}
              </span>
            </button>
            
            <div className="px-4 md:px-5 pb-4" style={{backgroundColor: 'rgba(0,0,0,0.2)'}}>
              <p className="text-sm md:text-base" style={{color: '#8ea1b8'}}>{item.description}</p>
            </div>
            
            {expanded === item.name && (
              <div className="p-4 md:p-5 border-t" style={{backgroundColor: 'rgba(106,165,255,0.08)', borderColor: 'rgba(106,165,255,0.15)'}}>
                <p className="leading-relaxed text-sm md:text-base whitespace-pre-wrap" style={{color: '#c8d4e2'}}>{item.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}