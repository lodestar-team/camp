import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "camp — community Amp for Arbitrum One",
  description:
    "Free, tip-fresh, best-effort REST gateway over Arbitrum One blocks/transactions/logs. Self-hosted Amp node on a single ThinkPad. No SLA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
