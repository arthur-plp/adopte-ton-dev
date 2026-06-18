"use client";

import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { toast } from "sonner";
import {
  Briefcase,
  CheckCircle2,
  Users,
  Zap,
  Star,
} from "lucide-react";
import { useState } from "react";

const PERKS = [
  "Accès à des profils de développeurs juniors qualifiés",
  "Filtrage avancé par stack technologique",
  "Score de matching automatique profil/offre",
  "Messagerie directe avec les candidats",
  "Publication d'offres stage, alternance, premier emploi",
  "Tableau de bord des candidatures",
];

export default function RecruteursPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-5%,oklch(0.85_0.08_264/25%),transparent)]"
          />
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5 text-sm text-violet-600">
              <Briefcase className="size-3.5" />
              Accès recruteur
            </div>
            <h1 className="mb-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Trouvez vos prochains{" "}
              <span className="bg-gradient-to-r from-violet-500 to-primary bg-clip-text text-transparent">
                développeurs juniors
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
              Adopte Ton Dev est une plateforme sur invitation pour les
              recruteurs. Remplissez le formulaire ci-dessous — nous vous
              créons votre accès sous 48&nbsp;h.
            </p>
          </div>
        </section>

        {/* Avantages + Formulaire */}
        <section className="pb-24">
          <div className="mx-auto grid max-w-5xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
            {/* Avantages */}
            <div>
              <h2 className="mb-6 text-xl font-semibold text-foreground">
                Ce que vous obtenez
              </h2>
              <ul className="space-y-3">
                {PERKS.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-start gap-2.5 text-sm text-foreground/80"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    {perk}
                  </li>
                ))}
              </ul>

              <div className="mt-8 grid grid-cols-3 gap-4 rounded-2xl border border-border bg-muted/30 p-5 text-center">
                {[
                  { icon: <Users className="mx-auto mb-1 size-5 text-primary" />, value: "100 %", label: "Profils vérifiés" },
                  { icon: <Zap className="mx-auto mb-1 size-5 text-violet-500" />, value: "< 48 h", label: "Temps d'accès" },
                  { icon: <Star className="mx-auto mb-1 size-5 text-yellow-500" />, value: "Gratuit", label: "Pour commencer" },
                ].map(({ icon, value, label }) => (
                  <div key={label}>
                    {icon}
                    <p className="text-lg font-bold text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulaire */}
            <ContactForm />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    jobTitle: "",
    teamSize: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/contact/recruiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error();
      toast.success("Demande envoyée !", {
        description: `Nous reviendrons vers vous à ${form.email} sous 48 h.`,
      });
      setForm({ firstName: "", lastName: "", email: "", company: "", jobTitle: "", teamSize: "", message: "" });
    } catch {
      toast.error("Une erreur s'est produite", {
        description: "Réessaie dans quelques instants.",
      });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <h2 className="mb-5 text-lg font-semibold text-foreground">
        Demander un accès recruteur
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom">
            <input
              type="text"
              required
              value={form.firstName}
              onChange={set("firstName")}
              placeholder="Alice"
              className="input-base"
            />
          </Field>
          <Field label="Nom">
            <input
              type="text"
              required
              value={form.lastName}
              onChange={set("lastName")}
              placeholder="Martin"
              className="input-base"
            />
          </Field>
        </div>

        <Field label="Email professionnel">
          <input
            type="email"
            required
            value={form.email}
            onChange={set("email")}
            placeholder="alice@entreprise.com"
            className="input-base"
          />
        </Field>

        <Field label="Entreprise">
          <input
            type="text"
            required
            value={form.company}
            onChange={set("company")}
            placeholder="Acme SAS"
            className="input-base"
          />
        </Field>

        <Field label="Poste">
          <input
            type="text"
            required
            value={form.jobTitle}
            onChange={set("jobTitle")}
            placeholder="Responsable RH, Tech Lead…"
            className="input-base"
          />
        </Field>

        <Field label="Taille de l'équipe tech">
          <select
            required
            value={form.teamSize}
            onChange={set("teamSize")}
            className="input-base"
          >
            <option value="">Sélectionner…</option>
            <option value="1-5">1 – 5 personnes</option>
            <option value="6-20">6 – 20 personnes</option>
            <option value="21-100">21 – 100 personnes</option>
            <option value="100+">100+ personnes</option>
          </select>
        </Field>

        <Field label="Votre besoin (optionnel)">
          <textarea
            rows={3}
            value={form.message}
            onChange={set("message")}
            placeholder="Types de profils recherchés, stack, rythme de recrutement…"
            className="input-base resize-none"
          />
        </Field>
      </div>

      <Button
        type="submit"
        className="mt-5 h-10 w-full"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Envoi en cours…" : "Envoyer ma demande"}
      </Button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Réponse garantie sous 48 h ouvrées.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
