import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuickShift",
  description: "Car inspection and maintenance logging",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
