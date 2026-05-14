'use client';

// T3-B: "Photos" dialog per listing row. Single-file upload server action
// called N times so the admin can pick multiple files and we surface
// per-file progress + per-file errors. Multi-file FormData would be one
// big atomic call — worse error semantics for the operator.

import { useState, useTransition } from 'react';
import { uploadListingPhotoAs } from '../actions';
import { InputStyles, Overlay } from '../../../_components/dialog-primitives';

interface Props {
  uid: string;
  propertyId: string;
  disabled: boolean;
}

interface FileState {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
  photoUrl?: string;
}

export function UploadPhotosButton({ uid, propertyId, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Photos
      </button>
      {open && (
        <UploadPhotosDialog
          uid={uid}
          propertyId={propertyId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function UploadPhotosDialog({
  uid,
  propertyId,
  onClose,
}: {
  uid: string;
  propertyId: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<FileState[]>([]);

  function onFilesPicked(picked: FileList | null) {
    if (!picked) return;
    const next: FileState[] = [...files];
    for (let i = 0; i < picked.length; i += 1) {
      const f = picked.item(i);
      if (!f) continue;
      next.push({
        id: `${Date.now()}-${i}-${f.name}`,
        file: f,
        status: 'queued',
      });
    }
    setFiles(next);
  }

  function removeFile(id: string) {
    setFiles((fs) => fs.filter((f) => f.id !== id));
  }

  function uploadAll() {
    // Upload sequentially — keeps progress UI honest + avoids hammering
    // the server action with N parallel multipart payloads.
    startTransition(async () => {
      // Snapshot the list once so we don't fight setState batching.
      const queue = files.filter((f) => f.status === 'queued');
      for (const item of queue) {
        setFiles((fs) =>
          fs.map((f) =>
            f.id === item.id ? { ...f, status: 'uploading' } : f
          )
        );
        try {
          const fd = new FormData();
          fd.append('file', item.file);
          const result = await uploadListingPhotoAs(uid, propertyId, fd);
          if (result.ok) {
            setFiles((fs) =>
              fs.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'done', photoUrl: result.photoUrl }
                  : f
              )
            );
          } else {
            setFiles((fs) =>
              fs.map((f) =>
                f.id === item.id
                  ? { ...f, status: 'error', error: result.error }
                  : f
              )
            );
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setFiles((fs) =>
            fs.map((f) =>
              f.id === item.id
                ? { ...f, status: 'error', error: msg }
                : f
            )
          );
        }
      }
    });
  }

  const anyQueued = files.some((f) => f.status === 'queued');

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Upload photos as partner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Uploads to <code className="rounded bg-muted px-1 py-0.5 text-xs">properties/{propertyId.slice(0, 8)}…/photos/</code>
          {' '}and appends each URL to <code className="rounded bg-muted px-1 py-0.5 text-xs">photoUrls[]</code>.
          Max 8 MB per file. JPEG / PNG / WebP / HEIC.
        </p>

        <div className="mt-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Pick files</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={(e) => onFilesPicked(e.target.files)}
              disabled={pending}
              className="mt-2 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80"
            />
          </label>
        </div>

        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.file.size / 1024).toFixed(0)} KB · {f.file.type}
                  </p>
                  {f.error && (
                    <p className="mt-1 text-xs text-destructive">{f.error}</p>
                  )}
                </div>
                <FileBadge status={f.status} />
                {f.status === 'queued' && (
                  <button
                    type="button"
                    onClick={() => removeFile(f.id)}
                    disabled={pending}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={uploadAll}
            disabled={pending || !anyQueued}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Uploading…' : `Upload ${files.filter((f) => f.status === 'queued').length}`}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

function FileBadge({ status }: { status: FileState['status'] }) {
  const map: Record<FileState['status'], { label: string; tone: string }> = {
    queued: { label: 'Queued', tone: 'bg-muted text-muted-foreground' },
    uploading: { label: 'Uploading…', tone: 'bg-amber-500/10 text-amber-700' },
    done: { label: 'Done', tone: 'bg-primary/10 text-primary' },
    error: { label: 'Error', tone: 'bg-destructive/10 text-destructive' },
  };
  const m = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.tone}`}>
      {m.label}
    </span>
  );
}
