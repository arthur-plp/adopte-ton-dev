import { z } from "zod";

/** Valide un CUID généré par Prisma (@default(cuid())) */
export const cuidLike = z
  .string()
  .regex(/^c[a-z0-9]{19,29}$/, "ID invalide");
