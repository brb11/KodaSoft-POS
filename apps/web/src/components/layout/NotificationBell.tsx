import React, { useEffect, useRef } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useLanguageStore, translate } from '../../stores/languageStore';
import { useNotificationsStore, AppNotification } from '../../stores/notificationsStore';

function notificationCopy(n: AppNotification, t: any) {
  const data = n.data;
  const date = data?.periodEnd
    ? new Date(data.periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  switch (n.type) {
    case 'trial_expiring':
      return {
        title: t.notifTrialExpiringTitle,
        body: translate(t.notifTrialExpiringBody, { date }),
      };
    case 'subscription_expiring':
      return {
        title: t.notifSubscriptionExpiringTitle,
        body: translate(t.notifSubscriptionExpiringBody, { plan: data?.planName ?? '', date }),
      };
    case 'trial_expired':
    case 'subscription_expired':
      return { title: t.notifExpiredTitle, body: t.notifExpiredBody };
    default:
      return { title: n.title, body: n.body };
  }
}

export const NotificationBell: React.FC = () => {
  const { t } = useLanguageStore();
  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const open = useNotificationsStore((s) => s.open);
  const fetch = useNotificationsStore((s) => s.fetch);
  const refreshUnread = useNotificationsStore((s) => s.refreshUnread);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const setOpen = useNotificationsStore((s) => s.setOpen);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshUnread();
    const timer = setInterval(() => refreshUnread(), 60 * 1000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  useEffect(() => {
    if (open) fetch();
  }, [open, fetch]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [setOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        title={t.notificationsTitle}
        aria-label={t.notificationsTitle}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[min(20rem,calc(100vw-2rem))] max-h-[420px] bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-extrabold text-slate-800">{t.notificationsTitle}</p>
            {unread > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-[10px] font-bold text-cyan-600 hover:text-cyan-800"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t.markAllRead}
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                <BellOff className="w-6 h-6" />
                <p className="text-xs font-bold">{t.notificationsEmpty}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {items.map((n) => {
                  const copy = notificationCopy(n, t);
                  const isRead = !!n.readAt;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => !isRead && markRead(n.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isRead ? 'bg-white hover:bg-slate-50' : 'bg-cyan-50/60 hover:bg-cyan-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-extrabold text-slate-800">{copy.title}</p>
                          {!isRead && <span className="mt-1 w-2 h-2 rounded-full bg-cyan-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{copy.body}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
