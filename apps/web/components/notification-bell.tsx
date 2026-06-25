"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageCircle, Briefcase, Megaphone, Info } from "lucide-react";
import { useRealtimeEvent } from "@/lib/realtime-socket";

type NotificationPayload = {
  conversationId?: string;
  jobOfferId?: string;
  recruiterId?: string;
  title?: string;
  status?: string;
};

type Notification = {
  id: string;
  userId: string;
  type: "APPLICATION" | "MESSAGE" | "JOB_ALERT" | "SYSTEM";
  payload: NotificationPayload;
  readAt: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30000;

const TYPE_ICON: Record<Notification["type"], React.ReactNode> = {
  APPLICATION: <Briefcase className="size-4" />,
  MESSAGE: <MessageCircle className="size-4" />,
  JOB_ALERT: <Megaphone className="size-4" />,
  SYSTEM: <Info className="size-4" />,
};

function notificationLabel(n: Notification): string {
  switch (n.type) {
    case "APPLICATION":
      return n.payload.recruiterId
        ? "Nouvelle candidature reçue"
        : `Candidature : statut mis à jour${n.payload.status ? ` (${n.payload.status})` : ""}`;
    case "MESSAGE":
      return "Nouveau message";
    case "JOB_ALERT":
      return n.payload.title ? `Nouvelle offre : ${n.payload.title}` : "Nouvelle offre correspondant à vos alertes";
    default:
      return "Notification";
  }
}

function notificationHref(n: Notification): string | null {
  switch (n.type) {
    case "APPLICATION":
      return n.payload.recruiterId && n.payload.jobOfferId
        ? `/jobs/${n.payload.jobOfferId}/edit`
        : "/applications";
    case "MESSAGE":
      return n.payload.conversationId ? `/messages?c=${n.payload.conversationId}` : "/messages";
    case "JOB_ALERT":
      return n.payload.jobOfferId ? `/offres/${n.payload.jobOfferId}` : "/offres";
    default:
      return null;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

export function NotificationBell() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = useCallback(() => {
    fetch(`${apiUrl}/notifications?page=1`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as { data?: Notification[] };
        setNotifications(d?.data ?? []);
      })
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useRealtimeEvent<Notification>("notification.new", (notification) => {
    setNotifications((prev) => [notification, ...prev]);
  });

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleClick(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      setNotifications((prev) =>
        prev.map((p) => (p.id === n.id ? { ...p, readAt: new Date().toISOString() } : p)),
      );
      fetch(`${apiUrl}/notifications/${n.id}/read`, { method: "PATCH", credentials: "include" }).catch(() => {});
    }
    const href = notificationHref(n);
    if (href) router.push(href);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((p) => ({ ...p, readAt: p.readAt ?? new Date().toISOString() })));
    fetch(`${apiUrl}/notifications/read-all`, { method: "PATCH", credentials: "include" }).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover p-1 shadow-md">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="my-1 border-t border-border" />

          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune notification
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${!n.readAt ? "bg-primary/5" : ""}`}
                >
                  <span className="mt-0.5 text-muted-foreground">{TYPE_ICON[n.type]}</span>
                  <span className="flex-1">
                    <span className={`block ${!n.readAt ? "font-medium text-foreground" : "text-foreground"}`}>
                      {notificationLabel(n)}
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
