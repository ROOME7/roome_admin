'use client';

// Chats tab on the Operate page. Lists chats the partner participates in,
// shows the counterparty's name + age, last-message preview, and an unread
// dot. Opening a chat loads the full message thread (loadChatThreadAs) and
// lets the admin send a reply AS the partner.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  loadChatThreadAs,
  sendChatMessageAs,
  type OperateChatMessage,
} from '../actions';
import type { OperateChatsSummary } from '../actions';
import { Field, InputStyles, Overlay } from '../../../_components/dialog-primitives';
import { useT } from '@/i18n/client';

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
  const t = useT();
  if (chats.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {t('operate.chatsEmpty')}
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

function counterpartyLabel(chat: OperateChatsSummary): string {
  if (chat.counterpartyName) return chat.counterpartyName;
  if (chat.counterpartyUid) return `${chat.counterpartyUid.slice(0, 12)}…`;
  return '(unknown)';
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const subtitleBits = [
    chat.counterpartyAge != null ? `${chat.counterpartyAge} yrs` : null,
    chat.counterpartyProfession,
  ].filter(Boolean);
  return (
    <article className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <Avatar url={chat.counterpartyPhotoUrl} name={counterpartyLabel(chat)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {counterpartyLabel(chat)}
          </span>
          {chat.hasUnread && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary"
              title={t('operate.chatUnreadTitle')}
            />
          )}
        </div>
        {subtitleBits.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {subtitleBits.join(' · ')}
          </p>
        )}
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {chat.lastMessageText ?? t('operate.chatNoMessages')}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs text-muted-foreground">
          {chat.lastMessageAt ? dateFormatter.format(chat.lastMessageAt) : '—'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t('operate.chatOpenButton')}
        </button>
      </div>
      {open && (
        <ChatThreadDialog
          uid={uid}
          chat={chat}
          disabled={disabled}
          onClose={() => setOpen(false)}
        />
      )}
    </article>
  );
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
      {initial}
    </div>
  );
}

function ChatThreadDialog({
  uid,
  chat,
  disabled,
  onClose,
}: {
  uid: string;
  chat: OperateChatsSummary;
  disabled: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [messages, setMessages] = useState<OperateChatMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshThread = useCallback(async () => {
    const result = await loadChatThreadAs(uid, chat.chatId);
    if (result.ok) {
      setMessages(result.messages);
      setLoadError(null);
    } else {
      setLoadError(result.error);
    }
  }, [uid, chat.chatId]);

  useEffect(() => {
    void refreshThread();
  }, [refreshThread]);

  // Keep the transcript pinned to the newest message as it loads / grows.
  useEffect(() => {
    if (messages && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await sendChatMessageAs(uid, chat.chatId, body);
      if (result.ok) {
        setBody('');
        await refreshThread();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Overlay onClose={pending ? () => {} : onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface p-6 shadow-xl">
        <header className="flex items-center gap-3">
          <Avatar
            url={chat.counterpartyPhotoUrl}
            name={counterpartyLabel(chat)}
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              {counterpartyLabel(chat)}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {[
                chat.counterpartyAge != null
                  ? `${chat.counterpartyAge} yrs`
                  : null,
                chat.counterpartyProfession,
              ]
                .filter(Boolean)
                .join(' · ') || t('operate.chatNoProfile')}
            </p>
          </div>
        </header>

        {/* Transcript */}
        <div
          ref={scrollRef}
          className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3"
          style={{ minHeight: '12rem' }}
        >
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : messages === null ? (
            <p className="text-sm text-muted-foreground">{t('operate.chatDialogLoadingThread')}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('operate.chatDialogNoMessages')}</p>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.messageId} message={m} partnerUid={uid} />
            ))
          )}
        </div>

        {/* Composer */}
        <div className="mt-4">
          <Field label={t('operate.chatDialogReplyLabel')} hint={`${body.length} / 4000`}>
            <textarea
              rows={3}
              maxLength={4000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending || disabled}
              className="input"
              placeholder={
                disabled
                  ? t('operate.chatDialogReplyLockedPlaceholder')
                  : t('operate.chatDialogReplyPlaceholder')
              }
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.close')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || disabled || body.trim().length === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-roome-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? t('operate.chatDialogSendingButton') : t('operate.chatDialogSendButton')}
          </button>
        </div>

        <InputStyles />
      </div>
    </Overlay>
  );
}

function MessageBubble({
  message,
  partnerUid,
}: {
  message: OperateChatMessage;
  partnerUid: string;
}) {
  const t = useT();
  // "Outgoing" = sent by the partner (the account we operate as). Those
  // sit on the right; the counterparty's messages on the left.
  const outgoing = message.senderId === partnerUid;
  const isSystem = message.senderId === 'system' || message.type === 'system';

  if (isSystem) {
    return (
      <p className="text-center text-[11px] italic text-muted-foreground">
        {message.content || t('operate.chatSystemEvent')}
      </p>
    );
  }

  return (
    <div className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          outgoing
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-foreground'
        }`}
      >
        {message.type === 'image_gallery' && message.imageUrls.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {message.imageUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={t('operate.chatImageAlt')}
                className="h-24 w-24 rounded object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        <p
          className={`mt-1 text-[10px] ${
            outgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {message.sentAt
            ? dateFormatter.format(message.sentAt)
            : '—'}
          {message.sentByAdminUid ? t('operate.chatViaAdmin') : ''}
        </p>
      </div>
    </div>
  );
}
