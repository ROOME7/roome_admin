'use client';

// Chats tab on the Operate page. Lists chats the partner participates in,
// shows last message preview + unread counter, and gives a compose dialog
// for sending a message AS the partner.
//
// Read view (the chat list itself) is rendered with data prefetched in
// the page Server Component. Per-chat message thread + send action are
// in <ComposeDialog>.

import { useState, useTransition } from 'react';
import { sendChatMessageAs } from '../actions';
import type { OperateChatsSummary } from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function ChatsTab({
  uid,
  chats,
  disabled,
}: {
  uid: string;
  chats: OperateChatsSummary[];
  disabled: boolean;
}) {
  if (chats.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No chats yet for this partner.
        </p>
      </section>
    );
  }

  return (
    <ul className="space-y-3">
      {chats.map((chat) => (
        <li key={chat.chatId}>
          <ChatRow uid={uid} chat={chat} disabled={disabled} />
        </li>
      ))}
    </ul>
  );
}

function ChatRow({
  uid,
  chat,
  disabled,
}: {
  uid: string;
  chat: OperateChatsSummary;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            with{' '}
            <span className="font-mono text-xs text-muted-foreground">
              {chat.counterpartyUid.slice(0, 12)}…
            </span>
          </span>
          {chat.unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {chat.unread}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {chat.lastMessageText ?? '(no messages yet)'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-muted-foreground">
          {chat.lastMessageAt ? dateFormatter.format(chat.lastMessageAt) : '—'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reply as partner
        </button>
      </div>
      {open && (
        <ComposeDialog
          uid={uid}
          chat={chat}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

function ComposeDialog({
  uid,
  chat,
  onClose,
}: {
  uid: string;
  chat: OperateChatsSummary;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await sendChatMessageAs(uid, chat.chatId, body);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">Reply as partner</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sends a text message to{' '}
          <span className="font-mono text-xs">{chat.counterpartyUid.slice(0, 12)}…</span>{' '}
          with the partner&apos;s uid as <code className="rounded bg-muted px-1 py-0.5 text-xs">senderId</code>.
          Your uid is stamped on the message in{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">_impersonatedByAdminUid</code>.
        </p>

        <div className="mt-5">
          <Field label="Message" required hint={`${body.length} / 4000`}>
            <textarea
              rows={6}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending}
              className="input"
              placeholder="Type a message…"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            onClick={submit}
            disabled={pending || body.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}
