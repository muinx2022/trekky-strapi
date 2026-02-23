import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { AuthProvider } from "@/components/auth-context";
import { SiteHeader } from "@/components/site-header";
import { LoginModal } from "@/components/login-modal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Starter Web",
  description: "Next.js storefront for posts, categories and comments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900`}
      >
        <AuthProvider>
          {/* Row 1: Header */}
          <SiteHeader />

          {/* Login Modal */}
          <LoginModal />

          {/* Row 2: Main Layout */}
          <div className="flex-1 container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Col 1: Left Sidebar */}
              <aside className="md:col-span-3 space-y-2">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                    Danh mục
                  </h3>
                  <LeftSidebar />
                </div>
              </aside>

              {/* Col 2: Main Content */}
              <main className="md:col-span-6 space-y-4">
                {children}
              </main>

              {/* Col 3: Right Sidebar */}
              <aside className="md:col-span-3 space-y-2">
                <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 font-semibold text-sm uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Bài viết nổi bật
                  </h3>
                  <RightSidebar />
                </div>
              </aside>
            </div>
          </div>

          {/* Row 3: Footer */}
          <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mt-auto">
            <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs">M</div>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">MyWeb</span>
              </div>
              <p>© {new Date().getFullYear()} MyWeb. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-blue-600 transition-colors">Điều khoản</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Bảo mật</a>
                <a href="#" className="hover:text-blue-600 transition-colors">Liên hệ</a>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
