import { CreateReportSchema, UpdateReportStatusSchema } from "./report.schema";

describe("CreateReportSchema", () => {
  it("accepte un signalement de profil valide", () => {
    const result = CreateReportSchema.safeParse({
      targetType: "profile",
      targetId: "dev-1",
      reason: "Contenu inapproprié",
    });
    expect(result.success).toBe(true);
  });

  it("accepte un signalement d'offre valide", () => {
    const result = CreateReportSchema.safeParse({
      targetType: "job",
      targetId: "job-1",
      reason: "Offre frauduleuse",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un targetType invalide", () => {
    const result = CreateReportSchema.safeParse({
      targetType: "message",
      targetId: "msg-1",
      reason: "Spam",
    });
    expect(result.success).toBe(false);
  });

  it("rejette une raison trop courte", () => {
    const result = CreateReportSchema.safeParse({
      targetType: "profile",
      targetId: "dev-1",
      reason: "x",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateReportStatusSchema", () => {
  it("accepte les statuts valides", () => {
    for (const status of ["open", "resolved", "dismissed"]) {
      expect(UpdateReportStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejette un statut invalide", () => {
    expect(UpdateReportStatusSchema.safeParse({ status: "closed" }).success).toBe(false);
  });
});
