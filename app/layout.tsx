import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wordgap",
  description: "Fill the gap between two letters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
