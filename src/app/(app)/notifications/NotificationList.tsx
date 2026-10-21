'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { markNotificationsSeen } from './actions';

export type NotificationItem = {
  key: string;
  kind: 'like' | 'comment' | 'broadcast';
  actor: string;
  actorAvatar: string | null;
  actorColor: string;
  href: string;
  body: string | null;
  postBody: string | null;
  when: string;
  unread: boolean;
};

const snippet = (s: string | null, n = 90) => (s && s.length > n ? s.slice(0, n).trimEnd() + '…' : s ?? '');

export function NotificationList({ items }: { items: NotificationItem[] }) {
  // Remember what was unread when the page opened, so the highlight stays after it is marked as seen.
  const [wasUnread] = useState(() => new Set(items.filter((i) => i.unread).map((i) => i.key)));

  useEffect(() => {
    if (wasUnread.size > 0) void markNotificationsSeen();
  }, [wasUnread]);

  if (items.length === 0) {
    return (
      <div className="card text-muted">
        Nothing yet. You’ll see likes and replies on your posts here, and news from your captain.
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-[14px] bg-white">
      {items.map((n) => {
        const unread = wasUnread.has(n.key);
        return (
          <li key={n.key} className="border-t border-line first:border-t-0">
            <Link href={n.href} className={`flex gap-3 px-4 py-3.5 hover:bg-ground sm:px-5 ${unread ? 'bg-[#FFF7ED]' : ''}`}>
              <Avatar name={n.actor} src={n.actorAvatar} color={n.actorColor} size={40} />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  <span className="font-semibold">{n.actor}</span>{' '}
                  {n.kind === 'like' && 'liked your post'}
                  {n.kind === 'comment' && 'replied to your post'}
                  {n.kind === 'broadcast' && <span className="font-semibold text-accent">posted team news</span>}
                </p>
                {n.kind === 'like' && <p className="mt-0.5 truncate text-sm text-muted">“{snippet(n.postBody)}”</p>}
                {n.kind === 'comment' && (
                  <>
                    <p className="mt-1 text-sm">“{snippet(n.body, 140)}”</p>
                    <p className="mt-0.5 truncate text-xs text-muted">On: {snippet(n.postBody, 60)}</p>
                  </>
                )}
                {n.kind === 'broadcast' && <p className="mt-1 whitespace-pre-line text-sm">{snippet(n.body, 200)}</p>}
                <p className="mt-1 text-xs text-muted">{n.when}</p>
              </div>
              {unread && <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-accent" aria-label="New" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
