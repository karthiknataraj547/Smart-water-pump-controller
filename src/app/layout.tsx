import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SmartPump — Production IoT Water Pump Controller',
  description: 'Industrial-grade water pump automation, real-time tank level monitoring, and zero-trust IoT hardware control.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
