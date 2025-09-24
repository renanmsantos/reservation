import AdminDashboard from "@/components/admin/admin-dashboard";

export const metadata = {
  title: "Admin Dashboard",
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <AdminDashboard />
      </div>
    </main>
  );
}
