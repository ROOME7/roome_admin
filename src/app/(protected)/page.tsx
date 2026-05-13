// Dashboard. The two flow links moved to the sidebar; this page now hosts
// at-a-glance stats + recent activity (placeholders until the data
// pipelines land).

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          At-a-glance view of B2B approvals and managed-account activity.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending B2B requests" value="—" />
        <StatCard label="Managed accounts" value="—" />
        <StatCard label="Active impersonation sessions" value="—" />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-900">Recent activity</h2>
        <p className="mt-1 text-sm text-gray-500">
          Audit feed coming next — will show role changes, impersonation sessions, and
          B2B approvals.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
