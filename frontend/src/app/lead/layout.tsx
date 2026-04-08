import AppSidebar from "@/components/AppSidebar";
import { DashboardProvider } from "@/components/DashboardContext";

export default function LeadLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </DashboardProvider>
  );
}
