import { UserForm } from "@/components/user-form";

export const dynamic = "force-dynamic";

export default function NewUserPage() {
  return <UserForm mode="create" />;
}
