"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

type Suggestion = {
  city: string;
  country: string;
  label: string;
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
};

type Props = {
  city: string;
  country: string;
  onChange: (city: string, country: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function CityAutocomplete({ city, country, onChange, placeholder = "Paris, Lyon…", disabled }: Props) {
  const [query, setQuery] = useState(city ? (country ? `${city}, ${country}` : city) : "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(city ? (country ? `${city}, ${country}` : city) : "");
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
          results.push({
            city: cityName,
            country: countryName,
            label: `${cityName}, ${countryName}`,
          });
          if (results.length >= 5) break;
        }
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
    setSuggestions([]);
    setOpen(false);
    onChange(s.city, s.country);
  }

  function handleBlur() {
    // If no suggestion was selected, keep what was typed as city
    setTimeout(() => {
      if (!open) return;
      setOpen(false);
    }, 150);
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {loading && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <input
          className="input-base pl-9"
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
