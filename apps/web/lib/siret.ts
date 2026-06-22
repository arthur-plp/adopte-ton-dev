type SearchResult = {
  siren?: string;
  etat_administratif?: string; // "A" actif | "C" cessée (unité légale)
  siege?: {
    siret?: string;
    etat_administratif?: string; // "A" actif | "F" fermé (établissement)
  };
};

type SearchApiResponse = {
  results?: SearchResult[];
  total_results?: number;
};

export type SiretCheckResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Vérifie qu'un SIRET (14 chiffres) correspond à une entreprise active
 * via l'API Recherche Entreprises (data.gouv.fr, sans clé API).
 *
 * Stratégie de fallback : si l'API est injoignable (timeout / erreur réseau),
 * on laisse passer pour ne pas bloquer sur une panne externe.
 * Si l'API répond mais ne trouve pas le SIRET → on bloque.
 */
export async function verifySiret(siret: string): Promise<SiretCheckResult> {
  let res: Response | null = null;
  try {
    res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&per_page=5`,
      { signal: AbortSignal.timeout(7000) },
    );
  } catch {
    console.warn("[verifySiret] API Recherche Entreprises injoignable, vérification ignorée");
    return { ok: true };
  }

  if (!res.ok) {
    console.warn(`[verifySiret] API a répondu ${res.status}, vérification ignorée`);
    return { ok: true };
  }

  const data = (await res.json()) as SearchApiResponse;

  if (!data.results?.length) {
    return { ok: false, error: "SIRET introuvable dans le registre officiel des entreprises. Vérifiez le numéro saisi." };
  }

  // Chercher un résultat correspondant au SIREN (9 premiers chiffres) ou au SIRET exact du siège
  const siren = siret.slice(0, 9);
  const match = data.results.find(
    (r) => r.siren === siren || r.siege?.siret === siret,
  );

  if (!match) {
    return { ok: false, error: "SIRET introuvable dans le registre officiel des entreprises. Vérifiez le numéro saisi." };
  }

  // Unité légale cessée (entreprise radiée)
  if (match.etat_administratif === "C") {
    return { ok: false, error: "L'entreprise associée à ce SIRET a cessé son activité (radiée). Vérifiez le numéro saisi." };
  }

  // Établissement siège fermé
  if (match.siege?.etat_administratif === "F") {
    return { ok: false, error: "L'établissement associé à ce SIRET est fermé. Vérifiez le numéro saisi." };
  }

  return { ok: true };
}
