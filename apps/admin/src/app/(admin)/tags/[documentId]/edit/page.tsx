import type { Metadata } from "next";
import { TagForm } from "@/components/tag-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Tag",
};

type EditTagPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditTagPage({ params }: EditTagPageProps) {
  const { documentId } = await params;
  return <TagForm mode="edit" documentId={documentId} />;
}
