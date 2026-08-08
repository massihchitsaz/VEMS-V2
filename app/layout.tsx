import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { PlatformShell } from "@/components/layout/PlatformShell";
import { PWARegister } from "@/components/pwa/PWARegister";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VTC ONE | Enterprise Platform",
  description: "VTC Group enterprise commercial, logistics, finance and treasury platform",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/vtc-one-icon.svg", apple: "/vtc-one-icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "VTC ONE" },
};

export const viewport: Viewport = { themeColor: "#060a12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full bg-[#060a12]">
        <PWARegister />
        <PlatformShell>{children}</PlatformShell>
      </body>
    </html>
  );
}
