import './global.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | ObjectStack',
    default: 'ObjectStack',
  },
  description:
    'The open target format and runtime for AI-written business apps — agents write compact typed metadata, the runtime derives the database, API, UI, and MCP server.',
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">{children}</body>
    </html>
  );
}
