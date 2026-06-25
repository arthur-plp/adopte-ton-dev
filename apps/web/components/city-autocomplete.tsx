"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";

export type Coordinates = { lat: number; lon: number };

type Suggestion = {
  city: string;
  country: string;
  label: string;
  coords?: Coordinates;
};

type PhotonFeature = {
  properties: {
    name?: string;
    city?: string;
    country?: string;
    countrycode?: string;
    type?: string;
    state?: string;
  };
  geometry?: {
    coordinates?: [number, number]; // [lon, lat], format GeoJSON
  };
};

type Props = {
  city: string;
  country: string;
  onChange: (city: string, country: string, coords?: Coordinates) => void;
  placeholder?: string;
  disabled?: boolean;
};

async function fetchSuggestions(value: string): Promise<Suggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(value)}&limit=6&lang=fr`;
  const res = await fetch(url);
  const data = (await res.json()) as { features: PhotonFeature[] };
  const seen = new Set<string>();
  const results: Suggestion[] = [];
  for (const f of data.features) {
    const p = f.properties;
    const cityName = p.city ?? p.name ?? "";
    const countryName = p.country ?? "";
    if (!cityName || !countryName) continue;
    const key = `${cityName}|${countryName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    results.push({
      city: cityName,
      country: countryName,
      label: `${cityName}, ${countryName}`,
      coords: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    });
    if (results.length >= 5) break;
  }
  return results;
}

export function CityAutocomplete({ city, country, onChange, placeholder = "Paris, Lyon…", disabled }: Props) {
  const initialQuery = city ? (country ? `${city}, ${country}` : city) : "";
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dernière valeur effectivement transmise au parent via onChange — permet
  // de détecter, au blur, un texte tapé mais jamais confirmé par un clic.
  const confirmedQueryRef = useRef(initialQuery);

  // Sync external value changes
  useEffect(() => {
    const next = city ? (country ? `${city}, ${country}` : city) : "";
    setQuery(next);
    confirmedQueryRef.current = next;
  }, [city, country]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchSuggestions(value);
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function select(s: Suggestion) {
    setQuery(s.label);
    confirmedQueryRef.current = s.label;
    setSuggestions([]);
    setOpen(false);
    onChange(s.city, s.country, s.coords);
  }

  function clear() {
    setQuery("");
    confirmedQueryRef.current = "";
    setSuggestions([]);
    setOpen(false);
    onChange("", "", undefined);
  }

  async function handleBlur() {
    setTimeout(() => setOpen(false), 150);

    // Texte tapé mais jamais confirmé par un clic sur une suggestion : sans
    // ça, la ville part sans coordonnées et la recherche par proximité (et
    // les villes limitrophes) ne fonctionne plus pour ce profil. On tente un
    // géocodage direct sur ce qui a été tapé, comme si l'utilisateur avait
    // cliqué le premier résultat.
    const typed = query.trim();
    if (!typed || typed === confirmedQueryRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    try {
      const results = await fetchSuggestions(typed);
      if (results[0]) {
        select(results[0]);
      } else {
        confirmedQueryRef.current = typed;
        onChange(typed, "", undefined);
      }
    } catch {
      confirmedQueryRef.current = typed;
      onChange(typed, "", undefined);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!loading && query && !disabled && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); clear(); }}
            aria-label="Effacer la localisation"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        <input
          className="input-base pl-9 pr-9"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => { e.preventDefault(); select(s); }}
              >
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium text-foreground">{s.city}</span>
                <span className="text-muted-foreground">{s.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
