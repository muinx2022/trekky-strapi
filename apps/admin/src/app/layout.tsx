import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastViewport } from "@/components/ui/app-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Starter Admin",
  description: "Refine admin with shadcn and Strapi REST API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var key='starter_admin_theme';var stored=localStorage.getItem(key);var system=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var theme=(stored==='dark'||stored==='light')?stored:system;document.documentElement.classList.toggle('dark',theme==='dark');}catch(e){}})();",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
