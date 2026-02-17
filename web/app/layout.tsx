import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ThemeProvider } from 'next-themes'
import { VercelAnalytics } from '@/components/VercelAnalytics';

const robotoMono = Roboto_Mono({ 
  subsets: ["latin"],
  variable: '--font-roboto-mono',
});

export const metadata: Metadata = {
  title: "Agent Reputation Oracle",
  description: "On-chain reputation system for AI agents on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${robotoMono.variable} font-mono`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </ThemeProvider>
        <VercelAnalytics />
      </body>
    </html>
  );
}
