// Dashboard skeleton. Two cards mapping to the two flows from
// docs/architecture/admin-panel.md §1. Both link to pages that don't exist
// yet — those will land in follow-up commits.

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
        <p className="mt-2 text-sm text-gray-600">
          Two flows: review B2B registrations and operate managed partner accounts.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/supervision"
          className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-300 hover:shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Supervision & Approval</h3>
          <p className="mt-1 text-sm text-gray-600">
            Review companies that registered as B2B and approve or reject them.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wide text-gray-400">Coming next</p>
        </Link>

        <Link
          href="/managed"
          className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-300 hover:shadow"
        >
          <h3 className="text-lg font-semibold text-gray-900">Active Management</h3>
          <p className="mt-1 text-sm text-gray-600">
            Create accounts on behalf of select partners and operate them via &ldquo;Manage As&rdquo;.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wide text-gray-400">Coming next</p>
        </Link>
      </section>
    </div>
  );
}
