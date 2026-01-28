import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "QuickShift",
  description: "Car inspection and maintenance logging",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QuickShift",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <QueryProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </QueryProvider>
      </body>
    </html>
  );
}
