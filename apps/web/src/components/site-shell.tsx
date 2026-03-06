import Link from "next/link";
import { ReactNode } from "react";
import { RightSidebar } from "@/components/right-sidebar";
import { SiteHeader } from "@/components/site-header";
import { LoginModal } from "@/components/login-modal";
import { LeftSidebar } from "@/components/left-sidebar";
import { MobileRightDrawer } from "@/components/mobile-right-drawer";
import { getFooterPages, getTopLevelCategories } from "@/lib/strapi";

export async function SiteShell({ children }: { children: ReactNode }) {
  let categories: Awaited<ReturnType<typeof getTopLevelCategories>> = [];
  let footerPages: Awaited<ReturnType<typeof getFooterPages>> = [];

  try {
    [categories, footerPages] = await Promise.all([
      getTopLevelCategories(),
      getFooterPages(),
    ]);
  } catch {
    categories = [];
    footerPages = [];
  }

  return (
    <>
      <SiteHeader />
      <LoginModal />

      <div id="mobile-left-drawer" className="mobile-left-drawer md:hidden" aria-modal="true" role="dialog">
        <a href="#" className="mobile-left-overlay" aria-label="Dong menu" />
        <aside className="mobile-left-panel">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">Danh muc</h3>
            <a href="#" className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Dong">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </a>
          </div>
          <LeftSidebar categories={categories} />
        </aside>
      </div>

      <MobileRightDrawer>
        <RightSidebar categories={categories} />
      </MobileRightDrawer>

      <div className="container mx-auto flex-1 px-4 py-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <main className="space-y-4 md:col-span-8">{children}</main>

          <aside className="hidden space-y-4 md:col-span-4 md:block">
            <RightSidebar categories={categories} />
          </aside>
        </div>
      </div>

      <footer className="sticky bottom-0 z-40 border-t border-gray-200 bg-white py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-2 text-sm text-gray-500 md:flex-row md:items-start">
            <div className="text-center md:text-left">
              {footerPages.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  {footerPages.map((page, idx) => (
                    <span key={page.documentId} className="flex items-center gap-2">
                      {idx > 0 && <span className="text-gray-300">|</span>}
                      <Link
                        href={`/page/${page.slug}`}
                        className="font-medium text-gray-700 transition-colors hover:text-gray-900 hover:underline"
                      >
                        {page.title}
                      </Link>
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <Link href="/page/quy-dinh" className="transition-colors hover:text-gray-700">Quy dinh</Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/page/gioi-thieu" className="transition-colors hover:text-gray-700">Gioi thieu</Link>
                  <span className="text-gray-300">|</span>
                  <Link href="/page/lien-he" className="transition-colors hover:text-gray-700">Lien he</Link>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span>&copy; {new Date().getFullYear()} Trekky</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
