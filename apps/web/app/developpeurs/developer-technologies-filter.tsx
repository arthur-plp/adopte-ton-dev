"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

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
  selected: string[];
  levels: Record<string, TechLevel>;
  onChange: (selected: string[], levels: Record<string, TechLevel>) => void;
};

/**
 * Sélecteur de technologies en mode "filtre" (sélection immédiate, pas de
 * staging/confirmation) — réutilise le catalogue et le langage visuel de
 * JobTechnologiesSelector (apps/web/app/jobs/job-technologies-selector.tsx),
 * adapté pour une recherche en direct côté recruteur.
 */
export function DeveloperTechnologiesFilter({ selected, levels, onChange }: Props) {
  const [search, setSearch] = useState("");

  const selectedSet = new Set(selected.map((t) => t.toLowerCase()));

  const filteredCatalog = CATALOG.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => search === "" || item.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((g) => g.items.length > 0);

  function toggle(item: string) {
    if (selectedSet.has(item.toLowerCase())) {
      const newLevels = { ...levels };
      delete newLevels[item];
      onChange(selected.filter((t) => t.toLowerCase() !== item.toLowerCase()), newLevels);
    } else {
      onChange([...selected, item], { ...levels, [item]: "INTERMEDIATE" });
    }
  }

  function handleRemove(tech: string) {
    const newLevels = { ...levels };
    delete newLevels[tech];
    onChange(selected.filter((t) => t !== tech), newLevels);
  }

  function handleLevelChange(tech: string, level: TechLevel) {
    onChange(selected, { ...levels, [tech]: level });
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((tech) => {
            const level: TechLevel = levels[tech] ?? "INTERMEDIATE";
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
                <button
                  type="button"
                  onClick={() => handleRemove(tech)}
                  className="ml-1 text-muted-foreground/50 transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <input
        className="input-base"
        placeholder="Rechercher une technologie souhaitée…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
        {filteredCatalog.map((group) => (
          <div key={group.category}>
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </p>
            <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
              {group.items.map((item) => {
                const isSelected = selectedSet.has(item.toLowerCase());
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(item)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                      isSelected ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5 text-primary-foreground" />}
                    </span>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
