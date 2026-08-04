import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PlatformShell } from "@/components/layout/PlatformShell";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VTC ONE | Enterprise Platform",
  description: "VTC Group enterprise commercial and treasury platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-[#060a12]">
        <PlatformShell>{children}</PlatformShell>
      </body>
    </html>
  );
}
