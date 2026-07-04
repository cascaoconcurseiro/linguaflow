import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinguaFlow — Anki Inteligente',
  description: 'Aprenda idiomas com repetição espaçada. Estude em qualquer lugar.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
