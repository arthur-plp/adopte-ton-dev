"use client";

import { useEffect, useState } from "react";
import { Bell, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { toast } from "sonner";

type JobAlertSubscription = {
  technologies: string[];
  remoteOk: boolean | null;
  location: string | null;
};

export function JobAlertCard() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [remoteOk, setRemoteOk] = useState(false);
  const [location, setLocation] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/notifications/job-alerts`, { credentials: "include" })
      .then((r) => (r.ok ? (r.json() as Promise<JobAlertSubscription | null>) : null))
      .then((sub) => {
        if (sub) {
          setTechnologies(sub.technologies);
          setRemoteOk(sub.remoteOk ?? false);
          setLocation(sub.location ?? "");
          setHasSubscription(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl]);

  function addTech() {
    const name = input.trim();
    if (!name || technologies.some((t) => t.toLowerCase() === name.toLowerCase())) return;
    setTechnologies((prev) => [...prev, name]);
    setInput("");
  }

  function removeTech(name: string) {
    setTechnologies((prev) => prev.filter((t) => t !== name));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/notifications/job-alerts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technologies,
          remoteOk,
          location: location.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setHasSubscription(true);
      toast.success("Alerte enregistrée");
    } catch {
      toast.error("Impossible d'enregistrer l'alerte");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      const res = await fetch(`${apiUrl}/notifications/job-alerts`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setTechnologies([]);
      setRemoteOk(false);
      setLocation("");
      setHasSubscription(false);
      toast.success("Alerte supprimée");
    } catch {
      toast.error("Impossible de supprimer l'alerte");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex justify-center py-6">
          <div className="size-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="icon-box text-amber-600 bg-amber-500/10">
          <Bell className="size-4" />
        </div>
        <div>
          <p className="font-medium text-foreground">Alertes offres</p>
          <p className="text-xs text-muted-foreground">
            Sois notifié quand une offre correspond à tes critères.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {technologies.map((tech) => (
            <span key={tech} className="badge">
              {tech}
              <button type="button" onClick={() => removeTech(tech)} className="ml-1 text-muted-foreground/60 hover:text-destructive">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="input-base flex-1 text-sm"
            placeholder="Technologie (ex. React, TypeScript)…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTech();
              }
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={addTech} disabled={!input.trim()}>
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={remoteOk}
              onChange={(e) => setRemoteOk(e.target.checked)}
              className="size-4 rounded border-border"
            />
            Remote uniquement
          </label>
          <div className="max-w-48 flex-1">
            <CityAutocomplete
              city={location}
              country=""
              onChange={(city) => setLocation(city)}
              placeholder="Localisation (optionnel)"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || technologies.length === 0}>
            Enregistrer
          </Button>
          {hasSubscription && (
            <Button type="button" size="sm" variant="ghost" onClick={handleClear} disabled={saving}>
              Désactiver
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
