"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type Technology = {
  id: string;
  name: string;
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

type Props = {
  technologies: Technology[];
  apiUrl: string;
  onUpdate: (techs: Technology[]) => void;
};

export function TechnologiesSection({ technologies, apiUrl, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [customName, setCustomName] = useState("");
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

  const existingNames = new Set(technologies.map((t) => t.name.toLowerCase()));

  const filteredCatalog = CATALOG.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !existingNames.has(item.toLowerCase()) &&
        (search === "" || item.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter((g) => g.items.length > 0);

  const nameToAdd = selected || customName.trim();

  async function handleAdd() {
    if (!nameToAdd) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/technologies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nameToAdd, level: newLevel }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        throw new Error(d.message ?? "Erreur");
      }
      const tech = (await res.json()) as Technology;
      onUpdate([...technologies, tech]);
      setSelected("");
      setCustomName("");
      setSearch("");
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleLevelChange(tech: Technology, level: SkillLevel) {
    setUpdatingId(tech.id);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/technologies/${tech.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ level }),
      });
      if (res.ok) {
        onUpdate(technologies.map((t) => (t.id === tech.id ? { ...t, level } : t)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(techId: string) {
    setDeletingId(techId);
    try {
      const res = await fetch(`${apiUrl}/users/developer/me/technologies/${techId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) onUpdate(technologies.filter((t) => t.id !== techId));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Tags des technos existantes */}
      {technologies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {technologies.map((tech) => (
            <div key={tech.id} className="group relative flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5">
              <span className="text-sm font-medium text-foreground">{tech.name}</span>
              <button
                type="button"
                disabled={updatingId === tech.id}
                className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-opacity ${LEVEL_COLORS[tech.level]} ${updatingId === tech.id ? "opacity-50" : ""}`}
                onClick={(e) => { e.stopPropagation(); setOpenLevelId(openLevelId === tech.id ? null : tech.id); }}
              >
                {LEVEL_LABELS[tech.level]}
                <ChevronDown className={`size-2.5 transition-transform ${openLevelId === tech.id ? "rotate-180" : ""}`} />
              </button>
              {openLevelId === tech.id && (
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[10rem] rounded-xl border border-border bg-popover p-1 shadow-md">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted ${tech.level === l ? "font-medium" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setOpenLevelId(null);
                        if (l !== tech.level) void handleLevelChange(tech, l);
                      }}
                    >
                      <span className={`size-2 rounded-full ${l === "BEGINNER" ? "bg-sky-400" : l === "INTERMEDIATE" ? "bg-violet-400" : "bg-emerald-400"}`} />
                      {LEVEL_LABELS[l]}
                      {tech.level === l && <span className="ml-auto text-xs text-muted-foreground">actuel</span>}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={deletingId === tech.id}
                onClick={() => void handleDelete(tech.id)}
                className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {technologies.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucune technologie ajoutée.</p>
      )}

      {/* Panneau d'ajout */}
      {adding ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          {/* Recherche */}
          <input
            autoFocus
            className="input-base"
            placeholder="Rechercher une technologie…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(""); setCustomName(""); }}
          />

          {/* Catalogue groupé */}
          <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-border bg-background p-2">
            {filteredCatalog.length === 0 && !search && (
              <p className="py-2 text-center text-xs text-muted-foreground">Toutes les technos sont déjà ajoutées.</p>
            )}
            {filteredCatalog.map((group) => (
              <div key={group.category}>
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.category}
                </p>
                <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => { setSelected(selected === item ? "" : item); setCustomName(""); }}
                      className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                        selected === item
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Champ libre si non trouvé */}
            {search && !CATALOG.flatMap((g) => g.items).some((i) => i.toLowerCase() === search.toLowerCase()) && (
              <div className="border-t border-border pt-2 mt-1">
                <p className="px-2 pb-1 text-xs text-muted-foreground">Pas dans la liste ?</p>
                <button
                  type="button"
                  onClick={() => { setCustomName(search); setSelected(""); }}
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

          {/* Sélection en cours + niveau */}
          {nameToAdd && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-sm font-medium text-primary">
                {nameToAdd}
              </span>
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
              onClick={() => { setAdding(false); setSelected(""); setCustomName(""); setSearch(""); setError(null); }}
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
          Ajouter une technologie
        </button>
      )}
    </div>
  );
}
