'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Define types based on your server response
interface StudentClass {
  class_id: number;
  status: string;
  name: string;
  methods: string[];
  stretch_methods?: string[];
  description: string;
  classwork?: string;
  notes?: string;
  hw?: string;
  hw_notes?: string;
  classwork_submission?: string;
  homework_submission?: string;
}

interface Student {
  id: number;
  name: string;
  age: number;
  current_level: string;
  final_goal: string;
  notes?: string;
  classes: StudentClass[];
  future_concepts: string[];
  current_class?: number;
}

// Helper to compute summary statistics
function computeStudentSummary(classes: StudentClass[]) {
  const total = classes.length;
  let completed = 0;
  let methods = 0, stretch = 0, skills = 0;
  for (const c of classes) {
    const st = (c.status || '').toLowerCase();
    if (st === 'completed' || st === 'done' || st === 'finished') completed++;
    methods += (c.methods || []).length;
    stretch += (c.stretch_methods || []).length;
    // skills_tested might not exist in your current data, but keep for safety
    skills += (c as any).skills_tested?.length || 0;
  }
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent, methods, stretch, skills };
}

// Component for a single class card
function ClassCard({ 
  classItem, 
  isCurrent, 
  studentId 
}: { 
  classItem: StudentClass; 
  isCurrent: boolean; 
  studentId: number; 
}) {
  // Determine card style based on status
  let cardClass = 'class-card';
  if (isCurrent) {
    cardClass = 'current-class-card';
  } else if (classItem.status === 'upcoming') {
    cardClass = 'upcoming-class-card';
  }

  // Helper to render a view button for long text (classwork or homework)
  const renderViewButton = (text: string | undefined, type: 'classwork' | 'homework', label: string, submission?: string) => {
    if (!text || text.trim() === '') return null;
    const preview = text.substring(0, 80) + '...';
    // Map type to short code: 'cw' for classwork, 'hw' for homework
    const typeCode = type === 'classwork' ? 'cw' : 'hw';
    return (
      <div className="class-field">
        <strong>{label}:</strong>
        <Link
          href={`/work?c=${classItem.class_id}&t=${typeCode}&s=${studentId}`}
          className="view-text-btn"
        >
          View {label}
        </Link>
        <span className="text-preview">{preview}</span>
      </div>
    );
  };

  return (
    <div className={cardClass} data-class-id={classItem.class_id}>
      <div className="class-card-header">
        <strong>{classItem.name}</strong>
        <span className="chip">
          {isCurrent ? 'current' : classItem.status}
        </span>
      </div>

      <div className="class-card-content">
        {classItem.description && (
          <div className="class-field">{classItem.description}</div>
        )}

        {classItem.methods?.length > 0 && (
          <div className="class-field">
            <strong>Objectives:</strong>
            <div className="chip-container">
              {classItem.methods.map((m, idx) => (
                <span key={idx} className="chip chip-soft">{m}</span>
              ))}
            </div>
          </div>
        )}

        {classItem.stretch_methods && classItem.stretch_methods.length > 0 && (
          <div className="class-field">
            <strong>Stretch Objectives:</strong>
            <div className="chip-container">
              {classItem.stretch_methods.map((m, idx) => (
                <span key={idx} className="chip chip-soft">{m}</span>
              ))}
            </div>
          </div>
        )}

        {renderViewButton(classItem.classwork, 'classwork', 'Classwork', classItem.classwork_submission)}
        {classItem.notes && (
          <div className="class-field"><strong>Notes:</strong> {classItem.notes}</div>
        )}
        {renderViewButton(classItem.hw, 'homework', 'Homework', classItem.homework_submission)}
        {classItem.hw_notes && (
          <div className="class-field"><strong>HW Notes:</strong> {classItem.hw_notes}</div>
        )}
      </div>
    </div>
  );
}

export default function StudentDetail({ student }: { student: Student }) {
  const summary = computeStudentSummary(student.classes);

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h2><strong>{student.name}</strong></h2>
      <div style={{ marginTop: '.75rem', display: 'grid', gap: '.35rem' }}>
        <div><strong>Level:</strong> {student.current_level}</div>
        <div><strong>Age:</strong> {student.age}</div>
        <div><strong>Final Goal:</strong> {student.final_goal}</div>
        <div><strong>Notes:</strong> {student.notes || '—'}</div>
      </div>

      {/* Progress bar */}
      <div className="pbar-wrap" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.4rem' }}>
          <div className="small" style={{ color: 'var(--muted)' }}>Overall Progress</div>
          <div className="small"><strong>{summary.completed}/{summary.total}</strong> ({summary.percent}%)</div>
        </div>
        <div className="pbar">
          <span style={{ width: `${summary.percent}%` }}></span>
        </div>
        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
          <span className="chip chip-soft">{summary.methods} methods</span>
          <span className="chip chip-soft">{summary.stretch} stretch</span>
          <span className="chip chip-soft">{summary.skills} skills</span>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

      {/* Classes header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
        <h3 style={{ margin: 0 }}>Classes</h3>
        <span className="chip chip-soft">{summary.total} total (so far)</span>
      </div>

      {/* Class cards */}
      {student.classes.length > 0 ? (
        <div className="classes-container">
          {student.classes.map((c) => (
            <ClassCard
              key={c.class_id}
              classItem={c}
              isCurrent={student.current_class === c.class_id}
              studentId={student.id}
            />
          ))}
        </div>
      ) : (
        <div className="empty">No classes found.</div>
      )}

      {/* Future concepts */}
      {student.future_concepts?.length > 0 && (
        <div className="future-concepts-card">
          <h3 style={{ margin: '0 0 .75rem 0', color: 'var(--text)' }}>Future Concepts</h3>
          <div className="future-concepts-list">
            {student.future_concepts.map((concept, idx) => (
              <span key={idx} className="concept-chip">{concept}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
