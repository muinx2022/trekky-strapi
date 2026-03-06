import type { Metadata } from "next";
import { UserForm } from "@/components/user-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add User",
};

export default function NewUserPage() {
  return <UserForm mode="create" />;
}
