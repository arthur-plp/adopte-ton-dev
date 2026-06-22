import { verifySiret } from "./siret";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("verifySiret", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("rejette un SIRET sans aucun résultat (inconnu du registre)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [], total_results: 0 }));

    const result = await verifySiret("00000000000012");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/introuvable/i);
  });

  it("rejette une entreprise radiée (état administratif C sur l'unité légale)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            siren: "439831660",
            etat_administratif: "C",
            siege: { siret: "43983166000030", etat_administratif: "F" },
          },
        ],
        total_results: 1,
      }),
    );

    const result = await verifySiret("43983166000030");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/radiée|cessé/i);
  });

  it("rejette un établissement fermé (siège état F) même si l'unité légale est active", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            siren: "123456789",
            etat_administratif: "A",
            siege: { siret: "12345678900012", etat_administratif: "F" },
          },
        ],
        total_results: 1,
      }),
    );

    const result = await verifySiret("12345678900012");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/fermé/i);
  });

  it("accepte un SIRET correspondant à une entreprise active", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          {
            siren: "552120222",
            etat_administratif: "A",
            siege: { siret: "55212022200013", etat_administratif: "A" },
          },
        ],
        total_results: 1,
      }),
    );

    const result = await verifySiret("55212022200013");

    expect(result.ok).toBe(true);
  });

  it("laisse passer si l'API est injoignable (panne réseau)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await verifySiret("55212022200013");

    expect(result.ok).toBe(true);
  });

  it("laisse passer si l'API répond avec une erreur HTTP (ex. 500)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));

    const result = await verifySiret("55212022200013");

    expect(result.ok).toBe(true);
  });

  it("interroge l'API avec le SIRET encodé dans le paramètre q", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [], total_results: 0 }));

    await verifySiret("55212022200013");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("recherche-entreprises.api.gouv.fr/search?q=55212022200013"),
      expect.any(Object),
    );
  });
});
