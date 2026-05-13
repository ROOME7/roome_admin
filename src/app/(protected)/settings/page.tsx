// /settings — admin account settings (placeholder).
// Future: change password, enroll MFA, review your own role change history.

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your admin account.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">
          Password change + MFA enrolment coming next.
        </p>
      </section>
    </div>
  );
}
