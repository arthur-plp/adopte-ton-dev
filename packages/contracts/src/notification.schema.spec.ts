import { UpsertJobAlertSchema } from './notification.schema';

describe('UpsertJobAlertSchema', () => {
  it("valide une liste de technologies seule", () => {
    const result = UpsertJobAlertSchema.parse({ technologies: ['TypeScript', 'React'] });
    expect(result.technologies).toEqual(['TypeScript', 'React']);
  });

  it('accepte remoteOk et location optionnels', () => {
    const result = UpsertJobAlertSchema.parse({
      technologies: ['Go'],
      remoteOk: true,
      location: 'Lyon',
    });
    expect(result.remoteOk).toBe(true);
    expect(result.location).toBe('Lyon');
  });

  it('rejette plus de 20 technologies', () => {
    expect(() =>
      UpsertJobAlertSchema.parse({
        technologies: Array.from({ length: 21 }, (_, i) => `tech-${i}`),
      }),
    ).toThrow();
  });

  it('accepte une liste de technologies vide (suppression des critères)', () => {
    expect(() => UpsertJobAlertSchema.parse({ technologies: [] })).not.toThrow();
  });

  it('rejette si technologies est manquant', () => {
    expect(() => UpsertJobAlertSchema.parse({})).toThrow();
  });
});
