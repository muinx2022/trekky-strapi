import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <AdminShell />;
}
