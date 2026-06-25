import { matchesJobAlert } from "./job-alert-matcher";

const offer = {
  requiredTechnologies: ["TypeScript", "React", "PostgreSQL"],
  remoteOk: true,
  location: "Lyon",
};

describe("matchesJobAlert", () => {
  it("matche si au moins une techno commune", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: null, location: null },
      offer,
    );
    expect(result).toBe(true);
  });

  it("ne matche pas sans aucune techno commune", () => {
    const result = matchesJobAlert(
      { technologies: ["Java", "Spring"], remoteOk: null, location: null },
      offer,
    );
    expect(result).toBe(false);
  });

  it("la comparaison de technologies est insensible à la casse", () => {
    const result = matchesJobAlert(
      { technologies: ["typescript"], remoteOk: null, location: null },
      offer,
    );
    expect(result).toBe(true);
  });

  it("ne matche pas si la liste de technologies de l'abonnement est vide", () => {
    const result = matchesJobAlert(
      { technologies: [], remoteOk: null, location: null },
      offer,
    );
    expect(result).toBe(false);
  });

  it("rejette si remoteOk est exigé mais l'offre n'est pas remote", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: true, location: null },
      { ...offer, remoteOk: false },
    );
    expect(result).toBe(false);
  });

  it("n'exclut pas si remoteOk n'est pas renseigné sur l'abonnement", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: null, location: null },
      { ...offer, remoteOk: false },
    );
    expect(result).toBe(true);
  });

  it("rejette si la localisation ne correspond pas", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: null, location: "Paris" },
      offer,
    );
    expect(result).toBe(false);
  });

  it("matche si la localisation correspond (insensible à la casse)", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: null, location: "lyon" },
      offer,
    );
    expect(result).toBe(true);
  });

  it("n'exclut pas si la localisation n'est pas renseignée sur l'abonnement", () => {
    const result = matchesJobAlert(
      { technologies: ["React"], remoteOk: null, location: null },
      { ...offer, location: null },
    );
    expect(result).toBe(true);
  });
});
