import AdminLoginForm from "@/components/admin/admin-login-form";

export const metadata = {
  title: "Login administrativo",
};

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40 px-6 py-16">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center text-foreground">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Apenas membros autorizados podem administrar vans, reservas e liberações.
          </p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
