"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        toast.error("Une erreur s'est produite", {
          description: "Réessaie dans quelques instants.",
        });
        return;
      }

      toast.success("Message envoyé !", {
        description: "Nous te répondrons dès que possible.",
      });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch {
      toast.error("Une erreur s'est produite", {
        description: "Réessaie dans quelques instants.",
      });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <input
            type="text"
            required
            value={form.name}
            onChange={set("name")}
            placeholder="Alice Martin"
            className="input-base"
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            required
            value={form.email}
            onChange={set("email")}
            placeholder="alice@exemple.com"
            className="input-base"
          />
        </Field>
      </div>

      <Field label="Sujet" required>
        <input
          type="text"
          required
          value={form.subject}
          onChange={set("subject")}
          placeholder="Question, suggestion, bug…"
          className="input-base"
        />
      </Field>

      <Field label="Message" required>
        <textarea
          required
          rows={6}
          value={form.message}
          onChange={set("message")}
          placeholder="Écris ton message ici…"
          className="input-base resize-none"
        />
      </Field>

      <button
        type="submit"
        disabled={status === "loading"}
        className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {status === "loading" ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
