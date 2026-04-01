import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stockity Dashboard',
  description: 'Stockity Schedule Bot Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
