import { computeMatchScore } from "./matching.score";

describe("computeMatchScore", () => {
  it("retourne null si aucune technologie n'est demandée", () => {
    expect(
      computeMatchScore([{ name: "React", level: "ADVANCED" }], []),
    ).toBeNull();
  });

  it("retourne 100 si toutes les technos demandées sont possédées (sans niveau requis)", () => {
    const score = computeMatchScore(
      [
        { name: "React", level: "BEGINNER" },
        { name: "Node.js", level: "BEGINNER" },
      ],
      ["React", "Node.js"],
    );
    expect(score).toBe(100);
  });

  it("retourne 0 si aucune technologie demandée n'est possédée", () => {
    const score = computeMatchScore(
      [{ name: "PHP", level: "ADVANCED" }],
      ["React", "Node.js"],
    );
    expect(score).toBe(0);
  });

  it("comparaison de noms insensible à la casse", () => {
    const score = computeMatchScore(
      [{ name: "react", level: "ADVANCED" }],
      ["React"],
    );
    expect(score).toBe(100);
  });

  it("compte 1 si le niveau du dev est >= niveau requis", () => {
    const score = computeMatchScore(
      [{ name: "React", level: "ADVANCED" }],
      ["React"],
      { React: "INTERMEDIATE" },
    );
    expect(score).toBe(100);
  });

  it("compte 0.5 si le niveau du dev est < niveau requis", () => {
    const score = computeMatchScore(
      [{ name: "React", level: "BEGINNER" }],
      ["React"],
      { React: "ADVANCED" },
    );
    expect(score).toBe(50);
  });

  it("calcule une moyenne pondérée sur plusieurs technologies", () => {
    const score = computeMatchScore(
      [
        { name: "React", level: "ADVANCED" },
        { name: "Node.js", level: "BEGINNER" },
      ],
      ["React", "Node.js", "PostgreSQL"],
      { React: "INTERMEDIATE", "Node.js": "ADVANCED" },
    );
    // React: niveau suffisant (+1), Node.js: niveau insuffisant (+0.5), PostgreSQL: absent (+0)
    // (1 + 0.5 + 0) / 3 * 100 = 50
    expect(score).toBe(50);
  });
});
