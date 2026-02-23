import { AdminProtectedLayout } from "@/components/admin-protected-layout";

export const dynamic = "force-dynamic";

export default function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;
}