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
  title: "camp — retired, superseded by nuthatch",
  description:
    "camp and Amp have been retired. Their functionality is now provided by nuthatch (nuthatch-indexer.com) — index any contract's events into a local SQL database.",
  openGraph: {
    title: "camp — retired, superseded by nuthatch",
    description:
      "camp and Amp have been retired. Use nuthatch (nuthatch-indexer.com) instead.",
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
