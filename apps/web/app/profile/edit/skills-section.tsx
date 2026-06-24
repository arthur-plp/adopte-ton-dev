"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, Check } from "lucide-react";
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
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [pendingLevels, setPendingLevels] = useState<Record<string, SkillLevel>>({});
  const [customNames, setCustomNames] = useState<Set<string>>(new Set());
  const [customCategories, setCustomCategories] = useState<Record<string, "technique" | "soft">>({});
  const [customInput, setCustomInput] = useState("");
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
  const selectedEntries = catalog.filter((c) => pending.has(c.id));
  const totalPending = selectedEntries.length + customNames.size;

  function toggle(id: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setPendingLevels((l) => { const n = { ...l }; delete n[id]; return n; });
      } else {
        next.add(id);
        setPendingLevels((l) => ({ ...l, [id]: "INTERMEDIATE" }));
      }
      return next;
    });
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name || existingNames.has(name.toLowerCase()) || customNames.has(name)) return;
    setCustomNames((prev) => new Set([...prev, name]));
    setPendingLevels((l) => ({ ...l, [name]: "INTERMEDIATE" }));
    setCustomCategories((c) => ({ ...c, [name]: "technique" }));
    setCustomInput("");
  }

  function removeCustom(name: string) {
    setCustomNames((prev) => { const n = new Set(prev); n.delete(name); return n; });
    setPendingLevels((l) => { const n = { ...l }; delete n[name]; return n; });
    setCustomCategories((c) => { const n = { ...c }; delete n[name]; return n; });
  }

  async function addOne(body: { skillId: string; level: SkillLevel } | { name: string; level: SkillLevel; category: string }, fallbackName: string) {
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
    const skillMeta: SkillCatalogEntry = entry.skill ?? { id: entry.skillId, name: fallbackName };
    return { ...entry, skill: skillMeta };
  }

  async function handleAdd() {
    if (totalPending === 0) return;
    setSaving(true);
    setError(null);
    try {
      const created: DeveloperSkillEntry[] = [];
      for (const entry of selectedEntries) {
        const level = pendingLevels[entry.id] ?? "INTERMEDIATE";
        created.push(await addOne({ skillId: entry.id, level }, entry.name));
      }
      for (const name of customNames) {
        const level = pendingLevels[name] ?? "INTERMEDIATE";
        const category = customCategories[name] ?? "technique";
        created.push(await addOne({ name, level, category }, name));
      }
      onUpdate([...skills, ...created]);
      setPending(new Set());
      setPendingLevels({});
      setCustomNames(new Set());
      setCustomCategories({});
      setCustomInput("");
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
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-border bg-background p-2">
            {filteredCatalog.length === 0 && !search && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                {catalog.length === 0
                  ? "Aucune compétence disponible dans le catalogue pour le moment."
                  : "Toutes les compétences sont déjà ajoutées."}
              </p>
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
                    {group.map((c) => {
                      const isPending = pending.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                            isPending
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isPending ? "border-primary bg-primary" : "border-border"
                          }`}>
                            {isPending && <Check className="size-2.5 text-primary-foreground" />}
                          </span>
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Saisie libre */}
          <div className="flex gap-2">
            <input
              className="input-base flex-1 text-sm"
              placeholder="Autre compétence (saisie libre)…"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!customInput.trim()}>
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Preview des sélections en attente avec niveau (+ catégorie pour le libre) par élément */}
          {totalPending > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Niveaux :</p>
              {selectedEntries.map((entry) => {
                const level = pendingLevels[entry.id] ?? "INTERMEDIATE";
                return (
                  <div key={entry.id} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm text-foreground">{entry.name}</span>
                    <div className="flex items-center gap-1">
                      {LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setPendingLevels((prev) => ({ ...prev, [entry.id]: l }))}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                            level === l ? LEVEL_COLORS[l] : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {LEVEL_LABELS[l]}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => toggle(entry.id)} className="text-muted-foreground/50 hover:text-destructive">
                      ×
                    </button>
                  </div>
                );
              })}
              {Array.from(customNames).map((name) => {
                const level = pendingLevels[name] ?? "INTERMEDIATE";
                const category = customCategories[name] ?? "technique";
                return (
                  <div key={name} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm text-foreground">{name}</span>
                    <div className="flex items-center gap-1">
                      {(["technique", "soft"] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCustomCategories((prev) => ({ ...prev, [name]: cat }))}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                            category === cat
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {cat === "technique" ? "Technique" : "Soft skill"}
                        </button>
                      ))}
                    </div>
                    <span className="text-muted-foreground/40">|</span>
                    <div className="flex items-center gap-1">
                      {LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setPendingLevels((prev) => ({ ...prev, [name]: l }))}
                          className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                            level === l ? LEVEL_COLORS[l] : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {LEVEL_LABELS[l]}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => removeCustom(name)} className="text-muted-foreground/50 hover:text-destructive">
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={totalPending === 0 || saving}
              onClick={() => void handleAdd()}
            >
              {saving ? "Ajout…" : `Ajouter${totalPending > 0 ? ` (${totalPending})` : ""}`}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setPending(new Set());
                setPendingLevels({});
                setCustomNames(new Set());
                setCustomCategories({});
                setCustomInput("");
                setSearch("");
                setError(null);
              }}
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
