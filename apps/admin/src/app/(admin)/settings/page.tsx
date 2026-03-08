import type { Metadata } from "next";
import { AiAutomationSettingsScreen } from "@/components/ai-automation-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AI Automation",
};

export default function SettingsPage() {
  return <AiAutomationSettingsScreen />;
}
