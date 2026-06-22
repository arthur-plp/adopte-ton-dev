"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SkillLevel } from "./technologies-section";

export type SkillCatalogEntry = { id: string; name: string; category?: string };
export type DeveloperSkillEntry = {
  id: string;
  skillId: string;
  skill: SkillCatalogEntry;
  level: SkillLevel;
};

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
  const [selectedId, setSelectedId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<"technique" | "soft">("technique");
  const [newLevel, setNewLevel] = useState<SkillLevel>("INTERMEDIATE");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openLevelId, setOpenLevelId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openLevelId) return;
    const close = () => setOpenLevelId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openLevelId]);

  const linkedSkillIds = new Set(skills.map((s) => s.skillId));
  const existingNames = new Set(
    skills.map((s) => s.skill?.name?.toLowerCase()).filter((n): n is string => n !== undefined)
  );

  const filteredCatalog = catalog
    .filter(
      (c) =>
        !linkedSkillIds.has(c.id) &&
        (search === "" || c.name.toLowerCase().includes(search.toLowerCase()))
    );

  const catalogByCategory = filteredCatalog.reduce<Record<string, SkillCatalogEntry[]>>(
    (acc, item) => {
      const cat = item.category ?? "technique";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(item);
      return acc;
    },
    {}
  );

  const categoryOrder = Object.keys(CATEGORY_LABELS);
  const selectedEntry = catalog.find((c) => c.id === selectedId);
  const nameToAdd = selectedEntry?.name ?? customName.trim();

  async function handleAdd() {
    if (!nameToAdd) return;
    setSaving(true);
    setError(null);
    try {
      const body = selectedId
        ? { skillId: selectedId, level: newLevel }
        : { name: nameToAdd, level: newLevel, category: customCategory };

      const res = await fetch(`${apiUrl}/users/developer/me/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        throw new Error(d.message ?? "Erreur");
      }
      const entry = (await res.json()) as {
        id: string;
        skillId: string;
        level: SkillLevel;
        skill?: SkillCatalogEntry;
      };
      const skillMeta: SkillCatalogEntry = entry.skill ?? {
        id: entry.skillId,
        name: nameToAdd,
      };
      onUpdate([...skills, { ...entry, skill: skillMeta }]);
      setSelectedId("");
      setCustomName("");
      setSearch("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
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
      if (res.ok) {
        onUpdate(skills.map((s) => (s.skillId === entry.skillId ? { ...s, level } : s)));
      } else {
        toast.error("Erreur lors de la mise à jour du niveau.");
      }
    } catch {
      toast.error("Erreur réseau.");
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
      if (res.ok) {
        onUpdate(skills.filter((s) => s.skillId !== skillId));
      } else {
        toast.error("Erreur lors de la suppression.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setDeletingId(null);
    }
  }

  const skillsByCategory = skills.reduce<Record<string, DeveloperSkillEntry[]>>(
    (acc, entry) => {
      const cat = entry.skill.category ?? "technique";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(entry);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-3">
      {/* Tags des compétences existantes */}
      {skills.length > 0 && (
        <div className="space-y-3">
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
                      className="group relative flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5"
                    >
                      <span className="text-sm font-medium text-foreground">{entry.skill.name}</span>
                      <button
                        type="button"
                        disabled={updatingId === entry.skillId}
                        className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-opacity ${LEVEL_COLORS[entry.level]} ${updatingId === entry.skillId ? "opacity-50" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenLevelId(openLevelId === entry.skillId ? null : entry.skillId);
                        }}
                      >
                        {LEVEL_LABELS[entry.level]}
                        <ChevronDown className={`size-2.5 transition-transform ${openLevelId === entry.skillId ? "rotate-180" : ""}`} />
                      </button>
                      {openLevelId === entry.skillId && (
                        <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-xl border border-border bg-popover p-1 shadow-md">
                          {LEVELS.map((l) => (
                            <button
                              key={l}
                              type="button"
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted ${entry.level === l ? "font-medium" : ""}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setOpenLevelId(null);
                                if (l !== entry.level) void handleLevelChange(entry, l);
                              }}
                            >
                              <span className={`size-2 rounded-full ${l === "BEGINNER" ? "bg-sky-400" : l === "INTERMEDIATE" ? "bg-violet-400" : "bg-emerald-400"}`} />
                              {LEVEL_LABELS[l]}
                              {entry.level === l && <span className="ml-auto text-xs text-muted-foreground">actuel</span>}
                            </button>
                          ))}
                        </div>
                      )}
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

      {skills.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucune compétence ajoutée.</p>
      )}

      {/* Panneau d'ajout */}
      {adding ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <input
            autoFocus
            className="input-base"
            placeholder="Rechercher une compétence…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedId(""); setCustomName(""); }}
          />

          <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-border bg-background p-2">
            {filteredCatalog.length === 0 && !search && (
              <p className="py-2 text-center text-xs text-muted-foreground">Toutes les compétences sont déjà ajoutées.</p>
            )}
            {categoryOrder.map((cat) => {
              const group = catalogByCategory[cat];
              if (!group || group.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
                    {group.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setSelectedId(selectedId === c.id ? "" : c.id); setCustomName(""); }}
                        className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                          selectedId === c.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Ajout libre si non trouvé dans le catalogue */}
            {search &&
              !catalog.some((c) => c.name.toLowerCase() === search.toLowerCase()) &&
              !existingNames.has(search.toLowerCase()) && (
              <div className="border-t border-border pt-2 mt-1">
                <p className="px-2 pb-1 text-xs text-muted-foreground">Pas dans la liste ?</p>
                <button
                  type="button"
                  onClick={() => { setCustomName(search); setSelectedId(""); }}
                  className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    customName === search
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  Ajouter &quot;{search}&quot;
                </button>
              </div>
            )}
          </div>

          {/* Sélection en cours + catégorie (custom seulement) + niveau */}
          {nameToAdd && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-sm font-medium text-primary">
                {nameToAdd}
              </span>
              {customName && (
                <>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className="text-sm text-muted-foreground">Type :</span>
                  {(["technique", "soft"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCustomCategory(cat)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        customCategory === cat
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {cat === "technique" ? "Technique" : "Soft skill"}
                    </button>
                  ))}
                </>
              )}
              <span className="text-sm text-muted-foreground">—</span>
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

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={!nameToAdd || saving} onClick={() => void handleAdd()}>
              {saving ? "Ajout…" : "Ajouter"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setAdding(false); setSelectedId(""); setCustomName(""); setCustomCategory("technique"); setSearch(""); setError(null); }}
            >
              Annuler
            </Button>
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
