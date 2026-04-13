import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SyncWatch",
  description: "Watch YouTube & Bilibili in perfect sync with friends."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-50 antialiased">
        {children}
      </body>
    </html>
  );
}
