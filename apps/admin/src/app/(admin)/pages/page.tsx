import type { Metadata } from "next";
import { PagesManager } from "@/components/pages-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pages",
};

export default function PagesPage() {
  return <PagesManager />;
}
