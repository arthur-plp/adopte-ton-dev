"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { JobTechnologiesSelector, type TechLevel } from "./job-technologies-selector";
import { CityAutocomplete } from "@/components/city-autocomplete";

export type JobOfferFormData = {
  title: string;
  description: string;
  type: "INTERNSHIP" | "APPRENTICESHIP" | "FIRST_JOB";
  location: string;
  country: string;
  remoteOk: boolean;
  requiredTechnologies: string[];
  requiredTechLevels: Record<string, TechLevel>;
  salaryMin: string;
  salaryMax: string;
  isPublic: boolean;
};

const EMPTY: JobOfferFormData = {
  title: "",
  description: "",
  type: "INTERNSHIP",
  location: "",
  country: "",
  remoteOk: false,
  requiredTechnologies: [],
  requiredTechLevels: {},
  salaryMin: "",
  salaryMax: "",
  isPublic: true,
};

const TYPE_LABELS: Record<JobOfferFormData["type"], string> = {
  INTERNSHIP: "Stage",
  APPRENTICESHIP: "Alternance",
  FIRST_JOB: "Premier emploi",
};

type Props = {
  initial?: Partial<JobOfferFormData>;
  onSave: (data: JobOfferFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  disabled?: boolean;
};

export function JobOfferForm({ initial, onSave, onCancel, submitLabel = "Enregistrer", disabled = false }: Props) {
  const [form, setForm] = useState<JobOfferFormData>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof JobOfferFormData>(field: K, value: JobOfferFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Le titre est requis."); return; }
    if (form.description.trim().length < 10) { setError("La description doit faire au moins 10 caractères."); return; }

    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
      <form onSubmit={handleSubmit} className="space-y-5">
      {/* Légende obligatoires */}
      <p className="text-right text-xs text-muted-foreground"><span className="text-destructive">*</span> Champs obligatoires</p>

      {/* Titre */}
      <Field label="Titre du poste" required>
        <input
          className="input-base"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex : Développeur React — Stage"
          maxLength={200}
          disabled={disabled}
        />
      </Field>

      {/* Type */}
      <Field label="Type de contrat" required>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as JobOfferFormData["type"][]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => !disabled && set("type", t)}
              disabled={disabled}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                form.type === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              } disabled:cursor-not-allowed`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </Field>

      {/* Description */}
      <Field label="Description du poste" required>
        <textarea
          className="input-base min-h-36 resize-y"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Décrivez le poste, les missions, les attentes…"
          maxLength={10000}
          disabled={disabled}
        />
        <span className="mt-1 block text-right text-xs text-muted-foreground">
          {form.description.length}/10000
        </span>
      </Field>

      {/* Localisation + remote */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ville">
          <CityAutocomplete
            city={form.location}
            country={form.country}
            onChange={(city, country) => setForm((prev) => ({ ...prev, location: city, country }))}
            placeholder="Paris, Lyon, Berlin…"
            disabled={disabled}
          />
        </Field>
        <div className="flex flex-col justify-end pb-1">
          <label className={`flex items-center gap-2.5 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              className="size-4 rounded border-border accent-primary"
              checked={form.remoteOk}
              onChange={(e) => set("remoteOk", e.target.checked)}
              disabled={disabled}
            />
            <span className="text-sm text-foreground">Télétravail possible</span>
          </label>
        </div>
      </div>

      {/* Salaire */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Salaire min (€/mois)">
          <input
            type="number"
            className="input-base"
            value={form.salaryMin}
            onChange={(e) => set("salaryMin", e.target.value)}
            placeholder="Ex : 600"
            min={0}
            disabled={disabled}
          />
        </Field>
        <Field label="Salaire max (€/mois)">
          <input
            type="number"
            className="input-base"
            value={form.salaryMax}
            onChange={(e) => set("salaryMax", e.target.value)}
            placeholder="Ex : 1200"
            min={0}
            disabled={disabled}
          />
        </Field>
      </div>

      {/* Technologies requises */}
      <Field label="Technologies requises">
        <JobTechnologiesSelector
          technologies={form.requiredTechnologies}
          techLevels={form.requiredTechLevels}
          onChange={(techs, levels) => !disabled && setForm((prev) => ({ ...prev, requiredTechnologies: techs, requiredTechLevels: levels }))}
          disabled={disabled}
        />
      </Field>

      {/* Erreur */}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Actions */}
      {!disabled && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            <Save className="size-3.5" />
            {saving ? "Enregistrement…" : submitLabel}
          </Button>
        </div>
      )}
      </form>
    </fieldset>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>
      {children}
    </div>
  );
}
