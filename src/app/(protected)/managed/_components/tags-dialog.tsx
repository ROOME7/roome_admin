'use client';

// "Tags" button + chip-input dialog. Lowercase-kebab labels, max 10 per
// account. Suggested tags below are starter labels; admins can type any
// custom tag that matches the regex.

import { useState, useTransition, type KeyboardEvent } from 'react';
import { setManagedAccountTags } from '../actions';
import type { ManagedAccount } from '../_lib/types';
import { InputStyles, Overlay } from './dialog-primitives';

const SUGGESTED_TAGS = [
  'pilot',
  'paying-partner',
  'churning',
  'vip',
  'complaint',
  'in-onboarding',
];
const TAG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_TAGS = 10;

interface Props {
  account: ManagedAccount;
}

export function TagsButton({ account }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Tags
        {account.adminTags.length > 0 && (
          <span className="ml-1.5 inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {account.adminTags.length}
          </span>
        )}
      </button>

      {open && <TagsDialog account={account} onClose={() => setOpen(false)} />}
    </>
  );
}

function TagsDialog({ account, onClose }: { account: ManagedAccount; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([...account.adminTags]);
  const [draft, setDraft] = useState('');

  function tryAdd(raw: string) {
    setError(null);
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (!TAG_RE.test(t)) {
      setError(`"${t}" is invalid — use lowercase letters, digits, dashes (1–40 chars).`);
      return;
    }
    if (tags.includes(t)) return;
    if (tags.length >= MAX_TAGS) {
      setError(`Max ${MAX_TAGS} tags per account.`);
      return;
    }
    setTags([...tags, t].sort());
    setDraft('');
  }

  function remove(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      tryAdd(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      remove(tags[tags.length - 1]);
    }
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setManagedAccountTags(account.uid, tags);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const unsuggested = SUGGESTED_TAGS.filter((s) => !tags.includes(s));

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Tags</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Categorize this account for filtering and reporting. Visible only to admins.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex min-h-[2.5rem] flex-wrap items-center gap-2 rounded-md border border-input bg-surface p-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => remove(t)}
                  disabled={pending}
                  className="rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
                  aria-label={`Remove ${t}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </span>
            ))}
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value.toLowerCase())}
              onKeyDown={onKey}
              onBlur={() => draft && tryAdd(draft)}
              disabled={pending || tags.length >= MAX_TAGS}
              className="min-w-[8rem] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
            />
          </div>

          {unsuggested.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Suggested:</span>
              {unsuggested.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => tryAdd(s)}
                  disabled={pending || tags.length >= MAX_TAGS}
                  className="rounded-full border border-dashed border-border bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save tags'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
