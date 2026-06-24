export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const LEVEL_RANK: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

export type DeveloperTechnologyInput = { name: string; level: SkillLevel };

/**
 * Score de recouvrement entre les technologies d'un profil développeur et
 * les technologies demandées (pondéré par niveau si un niveau requis est
 * fourni). Déterministe et pur — testable sans dépendance externe.
 *
 * - +1 si la techno est possédée au niveau requis ou supérieur (ou si aucun
 *   niveau n'est exigé pour cette techno)
 * - +0.5 si elle est possédée mais à un niveau inférieur au niveau requis
 * - +0 si elle est absente du profil
 *
 * Retourne `null` si aucune technologie n'est demandée (pas de tri pertinent).
 */
export function computeMatchScore(
  developerTechnologies: DeveloperTechnologyInput[],
  requiredTechnologies: string[],
  requiredLevels?: Record<string, SkillLevel> | null,
): number | null {
  if (requiredTechnologies.length === 0) return null;

  const devLevelByName = new Map(
    developerTechnologies.map((t) => [t.name.toLowerCase(), t.level]),
  );

  let total = 0;
  for (const required of requiredTechnologies) {
    const devLevel = devLevelByName.get(required.toLowerCase());
    if (!devLevel) continue;

    const requiredLevel = requiredLevels?.[required];
    if (!requiredLevel || LEVEL_RANK[devLevel] >= LEVEL_RANK[requiredLevel]) {
      total += 1;
    } else {
      total += 0.5;
    }
  }

  return Math.round((total / requiredTechnologies.length) * 100);
}
