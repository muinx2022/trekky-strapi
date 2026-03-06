import type { Metadata } from "next";
import { UsersManager } from "@/components/users-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage() {
  return <UsersManager />;
}
