"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";

export type ProjectFormData = {
  title: string;
  description: string;
  repoUrl: string;
  liveUrl: string;
  technologies: string[];
};

const empty: ProjectFormData = {
  title: "", description: "", repoUrl: "", liveUrl: "", technologies: [],
};

type Props = {
  initial?: ProjectFormData;
  onSave: (data: ProjectFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
};

export function ProjectForm({ initial = empty, onSave, onCancel, submitLabel = "Créer" }: Props) {
  const [form, setForm] = useState<ProjectFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [techInput, setTechInput] = useState("");

  function set<K extends keyof ProjectFormData>(k: K, v: ProjectFormData[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function addTech() {
    const t = techInput.trim();
    if (!t || form.technologies.includes(t)) return;
    set("technologies", [...form.technologies, t]);
    setTechInput("");
  }

  function removeTech(t: string) {
    set("technologies", form.technologies.filter((x) => x !== t));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError("Titre et description sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Titre *</label>
        <input
          autoFocus
          className="input-base"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Mon projet"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Description *</label>
        <textarea
          className="input-base min-h-20 resize-y"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Ce projet permet de…"
          maxLength={2000}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Lien GitHub</label>
          <input
            type="url"
            className="input-base"
            value={form.repoUrl}
            onChange={(e) => set("repoUrl", e.target.value)}
            placeholder="https://github.com/…"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Démo en ligne</label>
          <input
            type="url"
            className="input-base"
            value={form.liveUrl}
            onChange={(e) => set("liveUrl", e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Technologies</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.technologies.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
              {t}
              <button type="button" onClick={() => removeTech(t)} className="text-muted-foreground hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); } }}
            placeholder="React, TypeScript…"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTech}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Enregistrement…" : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
