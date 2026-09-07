import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Entrar · NextPlay',
  description:
    'Seu espaço para acompanhar filmes, séries e jogos. Qual é o seu próximo play?',
  icons: { icon: '/nextplay-symbol.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
