import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'ThinkBox — Multi-Agent Brainstorming',
  description: 'Watch three AI agents expand, critique, and evolve your ideas in a visual tree.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
