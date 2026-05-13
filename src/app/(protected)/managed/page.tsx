// /managed — Active Management (placeholder).
// The real list will read users where managedBy != null, surface a
// "Manage As" button per row (calls startImpersonation), plus actions
// to create a new managed account and to hand over an existing one.
// See docs/architecture/admin-panel.md §4.2-§4.4.

export default function ManagedAccountsPage() {
  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Active Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create accounts on behalf of select partners and operate them via
            &ldquo;Manage As&rdquo;.
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Managed-accounts list coming next. Create / Manage As / Hand over actions
          to follow.
        </p>
      </section>
    </div>
  );
}
