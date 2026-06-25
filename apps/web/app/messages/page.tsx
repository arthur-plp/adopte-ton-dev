"use client";

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { useRealtimeEvent } from "@/lib/realtime-socket";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Send, MessageCircle, Search, Check, CheckCheck, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type OtherParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  companyName: string | null;
  role: string;
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
  jobOfferTitle: string | null;
  createdAt: string;
  lastMessage: Message | null;
  unreadCount: number;
  otherParticipant: OtherParticipant;
};

const POLL_INTERVAL_MS = 5000;

// Même palette que la liste des utilisateurs admin (ROLE_COLORS) pour
// distinguer développeur/recruteur/admin au premier coup d'œil dans la messagerie.
const ROLE_RING_CLASS: Record<string, string> = {
  DEVELOPER: "ring-2 ring-sky-400/70",
  RECRUITER: "ring-2 ring-violet-400/70",
  ADMIN: "ring-2 ring-amber-400/70",
};

function initials(p: OtherParticipant): string {
  if (!p) return "?";
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function ParticipantAvatar({ participant, size = 9 }: { participant: OtherParticipant; size?: 9 | 8 }) {
  const sizeClass = size === 9 ? "size-9" : "size-8";
  const ringClass = participant ? ROLE_RING_CLASS[participant.role] ?? "" : "";
  if (participant?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={participant.avatarUrl}
        alt={`${participant.firstName} ${participant.lastName}`}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${ringClass}`}
      />
    );
  }
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ${ringClass}`}
    >
      {initials(participant)}
    </div>
  );
}

function ParticipantIdentity({ participant, jobOfferTitle }: { participant: OtherParticipant; jobOfferTitle?: string | null }) {
  return (
    <>
      {participant?.companyName && (
        <p className="truncate text-xs text-muted-foreground/80">{participant.companyName}</p>
      )}
      {jobOfferTitle && (
        <p className="truncate text-xs text-muted-foreground/70">À propos de « {jobOfferTitle} »</p>
      )}
    </>
  );
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
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => {
    if (!conversations) return conversations;
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const p = c.otherParticipant;
      const haystack = [p?.firstName, p?.lastName, p?.companyName, c.jobOfferTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, search]);

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
    })
      .then(fetchConversations)
      .catch(() => undefined);

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
      }).catch(() => undefined);
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

  async function handleDeleteConversation() {
    if (!activeId) return;
    const res = await fetch(`${apiUrl}/messaging/conversations/${activeId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      router.push("/messages");
      fetchConversations();
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
              className={`flex flex-col border-border md:border-r ${activeId ? "hidden md:flex" : ""}`}
            >
              {conversations && conversations.length > 0 && (
                <div className="relative border-b border-border/60 p-2">
                  <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une conversation…"
                    className="input-base pl-8 text-xs"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {conversations === null ? (
                  <div className="flex justify-center py-10">
                    <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">
                    Aucune conversation pour le moment.
                  </p>
                ) : filteredConversations?.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground/70">
                    Aucun résultat pour « {search} ».
                  </p>
                ) : (
                  filteredConversations?.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => router.push(`/messages?c=${c.id}`)}
                      className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted ${
                        c.id === activeId ? "bg-muted" : ""
                      }`}
                    >
                      <ParticipantAvatar participant={c.otherParticipant} />
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
                        <ParticipantIdentity participant={c.otherParticipant} jobOfferTitle={c.jobOfferTitle} />
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage?.content ?? "Aucun message"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
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
                    {activeConversation.otherParticipant?.role === "DEVELOPER" ? (
                      <Link
                        href={`/developpeurs/${activeConversation.otherParticipant.id}`}
                        className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
                      >
                        <ParticipantAvatar participant={activeConversation.otherParticipant} size={8} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground underline-offset-2 hover:underline">
                            {activeConversation.otherParticipant.firstName} {activeConversation.otherParticipant.lastName}
                          </p>
                          <ParticipantIdentity
                            participant={activeConversation.otherParticipant}
                            jobOfferTitle={activeConversation.jobOfferTitle}
                          />
                        </div>
                      </Link>
                    ) : (
                      <>
                        <ParticipantAvatar participant={activeConversation.otherParticipant} size={8} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {activeConversation.otherParticipant
                              ? `${activeConversation.otherParticipant.firstName} ${activeConversation.otherParticipant.lastName}`
                              : "Utilisateur"}
                          </p>
                          <ParticipantIdentity
                            participant={activeConversation.otherParticipant}
                            jobOfferTitle={activeConversation.jobOfferTitle}
                          />
                        </div>
                      </>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Supprimer la conversation"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette conversation ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tous les messages échangés seront définitivement
                            supprimés, pour toi comme pour{" "}
                            {activeConversation.otherParticipant?.firstName ?? "l'autre participant"}.
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className={buttonVariants({ variant: "destructive" })}
                            onClick={() => void handleDeleteConversation()}
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
                                className={`mt-0.5 flex items-center gap-1 text-[10px] ${
                                  mine ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}
                              >
                                {new Date(m.createdAt).toLocaleString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {mine && (
                                  m.readAt ? (
                                    <span title="Lu" className="inline-flex">
                                      <CheckCheck className="size-3" />
                                    </span>
                                  ) : (
                                    <span title="Envoyé" className="inline-flex">
                                      <Check className="size-3" />
                                    </span>
                                  )
                                )}
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
