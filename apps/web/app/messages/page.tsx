"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { useRealtimeEvent } from "@/lib/realtime-socket";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Send, MessageCircle, User } from "lucide-react";

type OtherParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
} | null;

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

type Conversation = {
  id: string;
  developerId: string;
  recruiterId: string;
  jobOfferId: string;
  createdAt: string;
  lastMessage: Message | null;
  unreadCount: number;
  otherParticipant: OtherParticipant;
};

const POLL_INTERVAL_MS = 5000;

function initials(p: OtherParticipant): string {
  if (!p) return "?";
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}

function MessagesPageContent() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(() => {
    fetch(`${apiUrl}/messaging/conversations`, { credentials: "include" })
      .then((res) => (res.ok ? (res.json() as Promise<Conversation[]>) : []))
      .then(setConversations)
      .catch(() => setConversations([]));
  }, [apiUrl]);

  const fetchMessages = useCallback(
    (conversationId: string) => {
      fetch(`${apiUrl}/messaging/conversations/${conversationId}/messages`, {
        credentials: "include",
      })
        .then((res) =>
          res.ok ? (res.json() as Promise<{ data: Message[] }>) : { data: [] },
        )
        .then((body) => setMessages(body.data))
        .catch(() => setMessages([]));
    },
    [apiUrl],
  );

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages(null);
      return;
    }
    setMessages(null);
    fetchMessages(activeId);
    fetch(`${apiUrl}/messaging/conversations/${activeId}/read`, {
      method: "PATCH",
      credentials: "include",
    }).then(fetchConversations);

    const interval = setInterval(() => fetchMessages(activeId), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useRealtimeEvent<Message>("message.new", (message) => {
    if (message.conversationId === activeId) {
      setMessages((prev) =>
        prev?.some((m) => m.id === message.id) ? prev : [...(prev ?? []), message],
      );
      fetch(`${apiUrl}/messaging/conversations/${activeId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    }
    fetchConversations();
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `${apiUrl}/messaging/conversations/${activeId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft.trim() }),
        },
      );
      if (res.ok) {
        setDraft("");
        fetchMessages(activeId);
        fetchConversations();
      }
    } finally {
      setSending(false);
    }
  }

  const activeConversation = conversations?.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="page-container max-w-5xl">
          <h1 className="mb-6 text-xl font-bold text-foreground">Messages</h1>

          <div className="card grid h-[70vh] grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr]">
            {/* Liste des conversations */}
            <div
              className={`border-border md:border-r ${activeId ? "hidden md:block" : ""} overflow-y-auto`}
            >
              {conversations === null ? (
                <div className="flex justify-center py-10">
                  <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">
                  Aucune conversation pour le moment.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => router.push(`/messages?c=${c.id}`)}
                    className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted ${
                      c.id === activeId ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.otherParticipant)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {c.otherParticipant
                            ? `${c.otherParticipant.firstName} ${c.otherParticipant.lastName}`
                            : "Utilisateur"}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage?.content ?? "Aucun message"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Fil actif */}
            <div className={`flex flex-col ${activeId ? "" : "hidden md:flex"}`}>
              {!activeId || !activeConversation ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/70">
                  <MessageCircle className="size-8" />
                  <p className="text-sm">Sélectionne une conversation</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <button
                      type="button"
                      onClick={() => router.push("/messages")}
                      className="text-xs text-muted-foreground hover:text-foreground md:hidden"
                    >
                      ← Retour
                    </button>
                    <User className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {activeConversation.otherParticipant
                        ? `${activeConversation.otherParticipant.firstName} ${activeConversation.otherParticipant.lastName}`
                        : "Utilisateur"}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
                    {messages === null ? (
                      <div className="flex justify-center py-10">
                        <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      </div>
                    ) : (
                      messages.map((m) => {
                        const mine = m.senderId === userId;
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                                mine
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              <p className="whitespace-pre-line">{m.content}</p>
                              <p
                                className={`mt-0.5 text-[10px] ${
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}
                              >
                                {new Date(m.createdAt).toLocaleString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <form
                    onSubmit={handleSend}
                    className="flex items-center gap-2 border-t border-border p-3"
                  >
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Écrire un message…"
                      maxLength={5000}
                      className="input-base flex-1"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="icon-box size-9 bg-primary text-primary-foreground disabled:opacity-50"
                      aria-label="Envoyer"
                    >
                      <Send className="size-4" />
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
