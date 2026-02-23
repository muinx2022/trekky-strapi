import Link from "next/link";
import { getTopLevelCategories } from "@/lib/strapi";

export async function LeftSidebar() {
  const categories = await getTopLevelCategories();

  return (
    <nav className="flex flex-col gap-0.5">
      {categories && categories.length > 0 ? (
        categories.map((category) => (
          <Link
            key={category.documentId}
            href={`/c/${category.slug}`}
            className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
          >
            <span className="text-zinc-400 group-hover:text-blue-500 transition-colors">#</span>
            {category.name}
          </Link>
        ))
      ) : (
        <div className="text-sm text-zinc-400 py-2 text-center">Không có danh mục</div>
      )}
    </nav>
  );
}
