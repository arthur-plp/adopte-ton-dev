import { z } from "zod";

/**
 * Empêche le stockage de balises HTML dans les champs de texte libre (bio,
 * descriptions de projets/offres/entreprise…) — défense en profondeur même si
 * le rendu React échappe déjà le contenu affiché côté client (cf. CLAUDE.md §31.4).
 * À appliquer via `.transform(sanitizeFreeText)` sur les champs concernés.
 */
export function sanitizeFreeText<T extends string | undefined>(value: T): T {
  if (value === undefined) return value;
  return value.replace(/<[^>]*>/g, "").trim() as T;
}

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * z.string().url() accepte n'importe quel schéma d'URI (javascript:, data:…) —
 * un lien "portfolio"/"GitHub" contenant javascript:alert(document.cookie),
 * exécuté au clic par un autre utilisateur, est une XSS stockée classique.
 * On restreint donc explicitement aux URLs http(s).
 */
export const httpUrl = z.string().url().refine(
  (value) => {
    try {
      return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  { message: "URL invalide : seuls les liens http(s) sont autorisés" },
);
