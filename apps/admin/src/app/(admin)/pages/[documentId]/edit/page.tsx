import type { Metadata } from "next";
import { PageForm } from "@/components/page-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Page",
};

type EditPagePageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditPagePage({ params }: EditPagePageProps) {
  const { documentId } = await params;
  return <PageForm mode="edit" documentId={documentId} />;
}
