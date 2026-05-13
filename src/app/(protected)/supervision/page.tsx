// /supervision — B2B approval queue (placeholder).
// The real list will read b2bOwnerRequests where status='pending' and
// surface Approve/Reject actions wired to the approveB2bOwnerRequest /
// rejectB2bOwnerRequest callables. See docs/architecture/admin-panel.md §1
// and §4.1.

export default function SupervisionPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Supervision &amp; Approval
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Review companies that self-registered as B2B and approve or reject pending
          applications.
        </p>
      </header>

      <section className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm text-gray-500">Approval queue coming next.</p>
      </section>
    </div>
  );
}
