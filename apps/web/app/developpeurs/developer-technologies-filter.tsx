"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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

const ALL_ITEMS = CATALOG.flatMap((group) => group.items.map((item) => ({ name: item, category: group.category })));

const POPULAR = ["TypeScript", "JavaScript", "React", "Node.js", "Python", "PostgreSQL", "Docker", "Next.js", "NestJS", "Java"];

const MAX_SUGGESTIONS = 8;

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
 * staging/confirmation) : recherche par autocomplétion + pastilles "populaires"
 * en repli, pour rester utilisable dans une sidebar étroite (cf. la grille de
 * catégories toujours visible débordait au-delà de 280px).
 */
export function DeveloperTechnologiesFilter({ selected, levels, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedSet = new Set(selected.map((t) => t.toLowerCase()));

  const suggestions = search.trim() === ""
    ? []
    : ALL_ITEMS.filter(
        (i) => !selectedSet.has(i.name.toLowerCase()) && i.name.toLowerCase().includes(search.trim().toLowerCase()),
      ).slice(0, MAX_SUGGESTIONS);

  const popularItems = POPULAR.filter((p) => !selectedSet.has(p.toLowerCase()));

  function toggle(item: string) {
    if (selectedSet.has(item.toLowerCase())) {
      const newLevels = { ...levels };
      delete newLevels[item];
      onChange(selected.filter((t) => t.toLowerCase() !== item.toLowerCase()), newLevels);
    } else {
      onChange([...selected, item], { ...levels, [item]: "INTERMEDIATE" });
    }
  }

  function handlePick(item: string) {
    toggle(item);
    setSearch("");
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

      <div className="relative" ref={containerRef}>
        <input
          className="input-base"
          placeholder="Rechercher une technologie souhaitée…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions.length > 0) {
              e.preventDefault();
              handlePick(suggestions[0]!.name);
            }
          }}
        />

        {open && search.trim() !== "" && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            {suggestions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</p>
            ) : (
              suggestions.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handlePick(item.name)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <span>{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.category}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {search.trim() === "" && popularItems.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Technologies populaires
          </p>
          <div className="flex flex-wrap gap-1.5">
            {popularItems.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <Plus className="size-3" />
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
