"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import type { SkillLevel } from "./technologies-section";

export type SkillCatalogEntry = { id: string; name: string; category?: string };
export type DeveloperSkillEntry = { id: string; skillId: string; skill: SkillCatalogEntry; level: SkillLevel };

const LEVEL_LABELS: Record<SkillLevel, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const LEVEL_COLORS: Record<SkillLevel, string> = {
  BEGINNER: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  INTERMEDIATE: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  ADVANCED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const LEVELS: SkillLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Compétences techniques",
  soft: "Soft skills",
};

type Props = {
  skills: DeveloperSkillEntry[];
  catalog: SkillCatalogEntry[];
  apiUrl: string;
  onUpdate: (skills: DeveloperSkillEntry[]) => void;
};

export function SkillsSection({ skills, catalog, apiUrl, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [newLevel, setNewLevel] = useState<SkillLevel>("INTERMEDIATE");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const linkedSkillIds = new Set(skills.map((s) => s.skillId));
  const availableCatalog = catalog.filter(
    (c) =>
      !linkedSkillIds.has(c.id) &&
      (search === "" || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Group available catalog by category
  const catalogByCategory = availableCatalog.reduce<Record<string, SkillCatalogEntry[]>>(
    (acc, item) => {
      const cat = item.category ?? "technique";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(item);
      return acc;
    },
    {}
  );

  // Group current skills by category
  const skillsByCategory = skills.reduce<Record<string, DeveloperSkillEntry[]>>(
    (acc, entry) => {
      const cat = entry.skill.category ?? "technique";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(entry);
      return acc;
    },
    {}
  );

  const categoryOrder = ["technique", "soft"];

  async function handleAdd() {
    if (!selectedSkillId) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ skillId: selectedSkillId, level: newLevel }),
      });
      if (res.ok) {
        const entry = (await res.json()) as { id: string; skillId: string; level: SkillLevel };
        const skillMeta = catalog.find((c) => c.id === selectedSkillId)!;
        onUpdate([...skills, { ...entry, skill: skillMeta }]);
        setSelectedSkillId("");
        setSearch("");
        setAdding(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLevelChange(entry: DeveloperSkillEntry, level: SkillLevel) {
    setUpdatingId(entry.skillId);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/skills/${entry.skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ level }),
      });
      if (res.ok) onUpdate(skills.map((s) => (s.skillId === entry.skillId ? { ...s, level } : s)));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemove(skillId: string) {
    setDeletingId(skillId);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/skills/${skillId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onUpdate(skills.filter((s) => s.skillId !== skillId));
    } finally {
      setDeletingId(null);
    }
  }

  const hasSkills = skills.length > 0;

  return (
    <div className="space-y-4">
      {hasSkills && (
        <div className="space-y-4">
          {categoryOrder.map((cat) => {
            const group = skillsByCategory[cat];
            if (!group || group.length === 0) return null;
            return (
              <div key={cat}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5"
                    >
                      <span className="text-sm font-medium text-foreground">{entry.skill.name}</span>
                      <button
                        type="button"
                        disabled={updatingId === entry.skillId}
                        className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[entry.level]}`}
                        onClick={() => {
                          const idx = LEVELS.indexOf(entry.level);
                          const next = LEVELS[(idx + 1) % LEVELS.length]!;
                          void handleLevelChange(entry, next);
                        }}
                        title="Cliquer pour changer le niveau"
                      >
                        {LEVEL_LABELS[entry.level]}
                        <ChevronDown className="size-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === entry.skillId}
                        onClick={() => void handleRemove(entry.skillId)}
                        className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasSkills && !adding && (
        <p className="text-sm text-muted-foreground">Aucune compétence ajoutée.</p>
      )}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <input
            autoFocus
            className="input-base"
            placeholder="Rechercher une compétence…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedSkillId("");
            }}
          />
          <div className="max-h-56 overflow-y-auto space-y-2">
            {availableCatalog.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">Aucune compétence trouvée</p>
            )}
            {categoryOrder.map((cat) => {
              const group = catalogByCategory[cat];
              if (!group || group.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <div className="grid gap-0.5">
                    {group.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedSkillId(selectedSkillId === c.id ? "" : c.id)}
                        className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selectedSkillId === c.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedSkillId && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Niveau :</span>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setNewLevel(l)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    newLevel === l ? LEVEL_COLORS[l] : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!selectedSkillId || saving}
              onClick={() => void handleAdd()}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Ajout…" : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setSearch("");
                setSelectedSkillId("");
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="size-4" />
          Ajouter une compétence
        </button>
      )}
    </div>
  );
}
