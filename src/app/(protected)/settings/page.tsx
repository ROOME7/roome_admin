// /settings — admin account settings (placeholder).
// Future: change password, enroll MFA, review your own role change history.

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your admin account.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Password change + MFA enrolment coming next.
        </p>
      </section>
    </div>
  );
}
