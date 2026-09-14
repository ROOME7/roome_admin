'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/i18n/client';
import { previewImport, saveMapping } from '../actions';
import type { FieldDef, ImportProfileSpec } from '../_lib/types';

/**
 * Every column of the sheet and the field it fills.
 *
 * ⚠️ CORRECTING A MAPPING NEEDS THE FILE AGAIN, AND THAT IS DELIBERATE. The
 * server keeps the parsed plan, not the spreadsheet, so a re-read re-posts the
 * upload. The file input below is that — not a second upload, the same one,
 * which is why it asks for it back rather than remembering a partner's data on
 * our disk.
 */
export function MappingPanel({
  importId,
  ownerId,
  ownerEmail,
  headers,
  mapping,
  headerHash,
  fields,
  readOnly,
}: {
  importId: string;
  ownerId: string;
  ownerEmail: string;
  headers: string[];
  mapping: ImportProfileSpec;
  headerHash: string | null;
  fields: FieldDef[];
  readOnly: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');

  // One row per column of the sheet, whether or not anything maps to it.
  const [assignments, setAssignments] = useState<Record<number, string>>(() => {
    const out: Record<number, string> = {};
    for (const column of mapping.columns) {
      // A column feeding two fields keeps the first here; the second is
      // preserved on re-read because it is untouched below.
      if (out[column.column] === undefined) out[column.column] = column.field;
    }
    return out;
  });

  const dirty = useMemo(
    () =>
      mapping.columns.some((c) => assignments[c.column] !== undefined && assignments[c.column] !== c.field) ||
      Object.entries(assignments).some(
        ([col, field]) => field === '' && mapping.columns.some((c) => c.column === Number(col)),
      ),
    [assignments, mapping.columns],
  );

  function nextSpec(): ImportProfileSpec {
    // Keep every extract and every second mapping on a column the admin did
    // not touch; replace only the field of the ones they changed.
    const columns = mapping.columns
      .map((c) => {
        const chosen = assignments[c.column];
        if (chosen === undefined || chosen === c.field) return c;
        if (chosen === '') return null;
        return { ...c, field: chosen, extract: undefined };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    // A column that had nothing mapped and now does.
    for (const [col, field] of Object.entries(assignments)) {
      if (!field) continue;
      const column = Number(col);
      if (!columns.some((c) => c.column === column && c.field === field)) {
        if (!mapping.columns.some((c) => c.column === column)) {
          columns.push({ column, field });
        }
      }
    }
    return { ...mapping, columns };
  }

  function reread(formData: FormData) {
    setError(null);
    startTransition(async () => {
      formData.set('ownerId', ownerId);
      formData.set('profile', JSON.stringify(nextSpec()));
      const result = await previewImport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const id = (result.data as { id?: string } | undefined)?.id;
      if (id) router.push(`/partner-imports/${id}`);
    });
  }

  function persist() {
    setError(null);
    startTransition(async () => {
      const result = await saveMapping({
        ownerId,
        name: name.trim() || `${ownerEmail} — ${new Date().toISOString().slice(0, 10)}`,
        spec: nextSpec(),
        headerHash: headerHash ?? undefined,
      });
      if (!result.ok) setError(result.error);
      else setSaved(true);
    });
  }

  const columnCount = Math.max(headers.length, ...mapping.columns.map((c) => c.column + 1), 0);

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-foreground">{t('partnerImports.mappingTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('partnerImports.mappingHelp')}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">{t('partnerImports.columnHeader')}</th>
              <th className="pb-2 font-medium">{t('partnerImports.fieldHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: columnCount }, (_, column) => {
              const mapped = mapping.columns.filter((c) => c.column === column);
              return (
                <tr key={column}>
                  <td className="py-2 pr-4 align-top">
                    <span className="font-medium text-foreground">
                      {headers[column]?.trim() || `#${column + 1}`}
                    </span>
                    {mapped.length > 1 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        + {mapped.slice(1).map((m) => m.field.replace(/^\w+\./, '')).join(', ')}
                      </span>
                    )}
                    {mapped.some((m) => m.extract) && (
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        part of the cell
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <select
                      disabled={readOnly || pending}
                      value={assignments[column] ?? ''}
                      onChange={(e) =>
                        setAssignments((prev) => ({ ...prev, [column]: e.target.value }))
                      }
                      className="w-full max-w-xs rounded-md border border-input bg-surface px-2 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
                    >
                      <option value="">{t('partnerImports.fieldNone')}</option>
                      {fields.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.scope === 'property' ? '🏠 ' : '🛏 '}
                          {f.label}
                          {f.requiredToPublish ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          <form action={reread} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs font-medium text-muted-foreground">
                {t('partnerImports.fileLabel')}
              </span>
              <input
                type="file"
                name="file"
                required
                accept=".xlsx"
                className="mt-1 block text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {pending ? t('partnerImports.rereading') : t('partnerImports.reread')}
            </button>
            {dirty && (
              <span className="text-xs text-amber-700">
                {t('partnerImports.mappingHelp').split('.')[0]}.
              </span>
            )}
          </form>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs font-medium text-muted-foreground">
                {t('partnerImports.saveProfileName')}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={ownerEmail}
                className="mt-1 w-64 rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={persist}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {t('partnerImports.saveProfile')}
            </button>
            {saved && <span className="text-xs text-primary">{t('partnerImports.profileSaved')}</span>}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Import {importId.slice(0, 8)}… · {mapping.layout.kind} layout · header row {mapping.headerRow}
      </p>
    </section>
  );
}
