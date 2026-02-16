'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface HeaderContextType {
  parentPath: string | null;
  setParentPath: (path: string | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [parentPath, setParentPath] = useState<string | null>(null);

  return (
    <HeaderContext.Provider value={{ parentPath, setParentPath }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeader must be used within a HeaderProvider');
  }
  return context;
}
