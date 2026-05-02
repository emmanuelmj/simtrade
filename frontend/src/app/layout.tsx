import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { LineChart, Briefcase, Trophy, Shield } from "lucide-react";
import ClientAppShell from "../components/ClientAppShell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Synthex - Trading Platform",
  description: "Next Generation AMM/CLOB Exchange",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-[#0a0a0c] text-slate-100 font-sans overflow-hidden">
        <ClientAppShell>
          {children}
        </ClientAppShell>
      </body>
    </html>
  );
}
