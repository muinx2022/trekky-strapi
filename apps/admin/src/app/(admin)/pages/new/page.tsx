import type { Metadata } from "next";
import { PageForm } from "@/components/page-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Page",
};

export default function NewPagePage() {
  return <PageForm mode="create" />;
}
