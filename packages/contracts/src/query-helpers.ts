import { z } from "zod";

/**
 * Un paramètre de query string répété (`?technologies=A&technologies=B`) est
 * parsé en tableau par Express/qs, mais une seule occurrence (`?technologies=A`)
 * est parsée comme une simple chaîne — pas comme un tableau à un élément.
 * Ce helper accepte les deux formes et normalise toujours vers un tableau.
 */
export const stringArrayQueryParam = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value : [value];
  });
