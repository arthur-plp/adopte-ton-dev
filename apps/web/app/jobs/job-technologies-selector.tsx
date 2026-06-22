"use client";

import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATALOG: { category: string; items: string[] }[] = [
  {
    category: "Langages",
    items: ["TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "PHP", "C#", "C++", "Ruby", "Swift", "Kotlin", "Dart"],
  },
  {
    category: "Frontend",
    items: ["React", "Next.js", "Vue.js", "Nuxt.js", "Angular", "Svelte", "SvelteKit", "TailwindCSS", "Sass / SCSS", "HTML / CSS"],
  },
  {
    category: "Backend",
    items: ["Node.js", "NestJS", "Express", "FastAPI", "Django", "Flask", "Laravel", "Spring Boot", "ASP.NET", "Ruby on Rails"],
  },
  {
    category: "Base de données",
    items: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Supabase", "Firebase", "Elasticsearch", "Prisma"],
  },
  {
    category: "DevOps / Cloud",
    items: ["Docker", "Kubernetes", "AWS", "GCP", "Azure", "Vercel", "Netlify", "Nginx", "GitHub Actions", "Terraform", "Linux"],
  },
  {
    category: "Outils & méthodes",
    items: ["Git", "GraphQL", "REST API", "WebSockets", "Jest", "Playwright", "Vite", "Webpack", "Storybook"],
  },
];

export type TechLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const LEVEL_LABELS: Record<TechLevel, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
};

const LEVEL_COLORS: Record<TechLevel, string> = {
  BEGINNER: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  INTERMEDIATE: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  ADVANCED: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
};

const LEVELS: TechLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

type Props = {
  technologies: string[];
  techLevels: Record<string, TechLevel>;
  onChange: (techs: string[], levels: Record<string, TechLevel>) => void;
  disabled?: boolean;
};

export function JobTechnologiesSelector({ technologies, techLevels, onChange, disabled = false }: Props) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [pendingLevels, setPendingLevels] = useState<Record<string, TechLevel>>({});
  const [customInput, setCustomInput] = useState("");

  const existingSet = new Set(technologies.map((t) => t.toLowerCase()));

  const filteredCatalog = CATALOG.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !existingSet.has(item.toLowerCase()) &&
        (search === "" || item.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter((g) => g.items.length > 0);

  function toggle(item: string) {
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
        setPendingLevels((l) => { const n = { ...l }; delete n[item]; return n; });
      } else {
        next.add(item);
        setPendingLevels((l) => ({ ...l, [item]: "INTERMEDIATE" }));
      }
      return next;
    });
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name || existingSet.has(name.toLowerCase())) return;
    setPending((prev) => new Set([...prev, name]));
    setPendingLevels((l) => ({ ...l, [name]: "INTERMEDIATE" }));
    setCustomInput("");
  }

  function handleConfirm() {
    if (pending.size === 0) return;
    const newTechs = Array.from(pending).filter((t) => !existingSet.has(t.toLowerCase()));
    const newLevels: Record<string, TechLevel> = { ...techLevels };
    for (const tech of newTechs) {
      newLevels[tech] = pendingLevels[tech] ?? "INTERMEDIATE";
    }
    onChange([...technologies, ...newTechs], newLevels);
    setPending(new Set());
    setPendingLevels({});
    setSearch("");
    setAdding(false);
  }

  function handleCancel() {
    setPending(new Set());
    setPendingLevels({});
    setSearch("");
    setCustomInput("");
    setAdding(false);
  }

  function handleRemove(tech: string) {
    const newLevels = { ...techLevels };
    delete newLevels[tech];
    onChange(technologies.filter((t) => t !== tech), newLevels);
  }

  function handleLevelChange(tech: string, level: TechLevel) {
    onChange(technologies, { ...techLevels, [tech]: level });
  }

  return (
    <div className="space-y-3">
      {technologies.length > 0 && (
        <div className="space-y-2">
          {technologies.map((tech) => {
            const level: TechLevel = (techLevels[tech] as TechLevel | undefined) ?? "INTERMEDIATE";
            return (
              <div
                key={tech}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{tech}</span>
                <div className="flex items-center gap-1">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => handleLevelChange(tech, lvl)}
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                        level === lvl
                          ? LEVEL_COLORS[lvl]
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {LEVEL_LABELS[lvl]}
                    </button>
                  ))}
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(tech)}
                    className="ml-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {technologies.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucune technologie requise.</p>
      )}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <input
            autoFocus
            className="input-base"
            placeholder="Rechercher une technologie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-border bg-background p-2">
            {filteredCatalog.length === 0 && !search && (
              <p className="py-2 text-center text-xs text-muted-foreground">Toutes les technos sont déjà ajoutées.</p>
            )}
            {filteredCatalog.map((group) => (
              <div key={group.category}>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.category}
                </p>
                <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
                  {group.items.map((item) => {
                    const selected = pending.has(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggle(item)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                          selected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <span className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          selected ? "border-primary bg-primary" : "border-border"
                        }`}>
                          {selected && <Check className="size-2.5 text-primary-foreground" />}
                        </span>
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {search && !CATALOG.flatMap((g) => g.items).some((i) => i.toLowerCase() === search.toLowerCase()) && !existingSet.has(search.toLowerCase()) && (
              <div className="border-t border-border pt-2 mt-1">
                <button
                  type="button"
                  onClick={() => { toggle(search); setSearch(""); }}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                    pending.has(search) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    pending.has(search) ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {pending.has(search) && <Check className="size-2.5 text-primary-foreground" />}
                  </span>
                  Ajouter &quot;{search}&quot;
                </button>
              </div>
            )}
          </div>

          {/* Saisie libre */}
          <div className="flex gap-2">
            <input
              className="input-base flex-1 text-sm"
              placeholder="Autre technologie (saisie libre)…"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!customInput.trim()}>
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Preview des sélections en attente avec niveau */}
          {pending.size > 0 && (
            <div className="space-y-1.5 rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Niveaux requis :</p>
              {Array.from(pending).map((t) => {
                const lvl: TechLevel = (pendingLevels[t] as TechLevel | undefined) ?? "INTERMEDIATE";
                return (
                  <div key={t} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm text-foreground">{t}</span>
                    <div className="flex items-center gap-1">
                      {LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setPendingLevels((prev) => ({ ...prev, [t]: level }))}
                          className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                            lvl === level
                              ? LEVEL_COLORS[level]
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {LEVEL_LABELS[level]}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => toggle(t)} className="text-muted-foreground/50 hover:text-destructive">
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending.size === 0} onClick={handleConfirm}>
              Ajouter {pending.size > 0 ? `(${pending.size})` : ""}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
              Annuler
            </Button>
          </div>
        </div>
      ) : !disabled && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="size-4" />
          Ajouter des technologies
        </button>
      )}
    </div>
  );
}
