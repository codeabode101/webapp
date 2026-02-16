'use client';

import { createContext, useContext, ReactNode } from 'react';

interface Student {
  id: number;
  name: string;
  age: number;
  current_level: string;
  final_goal: string;
  notes?: string;
  classes: any[];
  future_concepts: string[];
  current_class?: number;
}

interface StudentContextType {
  getStudent: (id: number) => Student | undefined;
  setStudent: (id: number, data: Student) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export function StudentProvider({ children }: { children: ReactNode }) {
  // Simple in-memory cache
  const cache = new Map<number, Student>();

  const getStudent = (id: number) => cache.get(id);
  const setStudent = (id: number, data: Student) => cache.set(id, data);

  return (
    <StudentContext.Provider value={{ getStudent, setStudent }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within StudentProvider');
  }
  return context;
}
