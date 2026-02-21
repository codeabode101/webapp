import type { Metadata } from "next";
import { AuthProvider } from '@/lib/auth';
import { HeaderProvider } from '@/lib/header-context';
import { StudentProvider } from '@/lib/student-context'; 
import { ProjectProvider } from '@/lib/project-context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: "Codeabode App",
  description: "Track info about your students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <HeaderProvider>
            <StudentProvider>   
              <ProjectProvider>
                <Header />
                <main className="min-h-screen">{children}</main>
                <Footer />
              </ProjectProvider>
            </StudentProvider>
          </HeaderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
