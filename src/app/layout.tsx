import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "camp — Arbitrum's data engine",
  description:
    "Free, tip-fresh REST gateway over Arbitrum One blocks/transactions/logs. Runs a self-built Amp fork (lodestar-team/amp), no SLA, no signup, no closed-source black box.",
  openGraph: {
    title: "camp — Arbitrum's data engine",
    description:
      "Free, tip-fresh REST gateway over Arbitrum One blocks/transactions/logs.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
