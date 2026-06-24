import { MatchingSearchFiltersSchema } from "./matching.schema";

describe("MatchingSearchFiltersSchema", () => {
  it("accepte un payload vide (tous les champs sont optionnels)", () => {
    const result = MatchingSearchFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("parse technologies, remoteOk et location", () => {
    const result = MatchingSearchFiltersSchema.parse({
      technologies: ["React", "Node.js"],
      remoteOk: "true",
      location: "Paris",
    });
    expect(result).toEqual({
      technologies: ["React", "Node.js"],
      remoteOk: true,
      location: "Paris",
    });
  });

  it("parse levels depuis une chaîne JSON valide", () => {
    const result = MatchingSearchFiltersSchema.parse({
      levels: JSON.stringify({ React: "ADVANCED" }),
    });
    expect(result.levels).toEqual({ React: "ADVANCED" });
  });

  it("rejette levels si le JSON est invalide", () => {
    const result = MatchingSearchFiltersSchema.safeParse({ levels: "pas-du-json" });
    expect(result.success).toBe(false);
  });

  it("rejette levels si les niveaux ne sont pas des SkillLevel valides", () => {
    const result = MatchingSearchFiltersSchema.safeParse({
      levels: JSON.stringify({ React: "EXPERT" }),
    });
    expect(result.success).toBe(false);
  });

  it("conserve jobOfferId tel quel", () => {
    const result = MatchingSearchFiltersSchema.parse({ jobOfferId: "job-1" });
    expect(result.jobOfferId).toBe("job-1");
  });
});
