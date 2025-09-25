import AdminDashboard from "@/components/admin/admin-dashboard";
import { assertAdminAuthenticated } from "@/lib/auth";

export const metadata = {
  title: "Painel administrativo",
};

export default async function AdminPage() {
  await assertAdminAuthenticated();
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 px-6 py-12 text-foreground">
      <div className="mx-auto max-w-6xl">
        <AdminDashboard />
      </div>
    </main>
  );
}
