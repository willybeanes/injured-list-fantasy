import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "Injured List Fantasy — Fantasy Baseball Where Injuries Win",
  description:
    "Draft MLB players and score points for every day they spend on the Injured List. The sicker your roster, the higher you climb.",
  openGraph: {
    title: "Injured List Fantasy",
    description: "Fantasy baseball with a twist — injuries score points.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('il-theme')||'dark';document.documentElement.classList.toggle('dark',t==='dark')})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
