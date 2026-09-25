import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "wren.gg",
  description: "A little collection of games to play with.",
};

// apply the saved theme before paint so there's no flash between routes
const themeScript = `try{document.documentElement.setAttribute('data-theme',localStorage.getItem('wg_theme')==='light'?'light':'dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
