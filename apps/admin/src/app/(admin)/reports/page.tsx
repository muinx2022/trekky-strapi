import type { Metadata } from "next";
import { ReportsManager } from "@/components/reports-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  return <ReportsManager />;
}
