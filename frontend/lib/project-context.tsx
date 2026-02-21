'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface Project {
  id: number;
  title: string;
  description: string;
  author_name: string | null;
  views: number;
  status: string; // 'pending', 'building', 'ready', 'failed'
  created_at: string;
  url: string;
}

interface ProjectContextType {
  getProject: (id: number) => Project | undefined;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  // Simple in‑memory cache
  const cache = new Map<number, Project>();

  const getProject = (id: number) => cache.get(id);

  const setProjects = (projects: Project[]) => {
    cache.clear();
    projects.forEach(p => cache.set(p.id, p));
  };

  const addProject = (project: Project) => {
    cache.set(project.id, project);
  };

  return (
    <ProjectContext.Provider value={{ getProject, setProjects, addProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider');
  }
  return context;
}
