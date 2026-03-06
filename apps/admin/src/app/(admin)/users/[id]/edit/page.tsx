import type { Metadata } from "next";
import { UserForm } from "@/components/user-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit User",
};

type EditUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUserPage({ params }: EditUserPageProps) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isFinite(userId)) {
    return <p className="text-sm text-destructive">Invalid user id</p>;
  }

  return <UserForm mode="edit" userId={userId} />;
}
