'use client';

// Shared dialog primitives reused across managed-account dialogs
// (create, edit, notes, tags, handover). The CSS-in-JS variant of the
// .input class lives in each form because <style jsx> is scoped to the
// owning component — duplicating that one block is the cost of keeping
// these primitives styling-free.

import type { ReactNode } from 'react';

export function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      // items-start (NOT items-center) so tall dialogs scroll naturally
      // inside the overlay. items-center used to vertically center the
      // card, which broke scrolling for forms taller than the viewport
      // (Create Listing dialog — feedback 2026-05-18 #1). py-8 gives
      // some breathing room top/bottom.
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-8 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="contents"
      >
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  required = false,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm font-medium text-foreground">
        <span>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

// Style block reused by every dialog form. Import + render once per
// dialog to keep .input working.
export function InputStyles() {
  return (
    <style jsx>{`
      :global(.input) {
        margin-top: 0.375rem;
        display: block;
        width: 100%;
        border-radius: 0.375rem;
        border-width: 1px;
        border-color: hsl(var(--input));
        background-color: hsl(var(--surface));
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: hsl(var(--foreground));
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      }
      :global(.input::placeholder) {
        color: hsl(var(--muted-foreground));
      }
      :global(.input:focus) {
        outline: none;
        border-color: hsl(var(--ring));
        box-shadow: 0 0 0 2px hsl(var(--ring) / 0.3);
      }
      :global(.input:disabled) {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `}</style>
  );
}
