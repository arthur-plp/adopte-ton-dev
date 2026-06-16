import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  ApplicationFiltersSchema,
} from './application.schema';
import { ApplicationStatus } from '@repo/types';

const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

// ─── CreateApplicationSchema ──────────────────────────────────────────────────

describe('CreateApplicationSchema', () => {
  it('valide une candidature minimale (jobOfferId seul)', () => {
    expect(() =>
      CreateApplicationSchema.parse({ jobOfferId: validCuid }),
    ).not.toThrow();
  });

  it('valide une candidature avec lettre de motivation', () => {
    const result = CreateApplicationSchema.parse({
      jobOfferId: validCuid,
      coverLetter: 'Bonjour, je suis très motivé par ce poste...',
    });
    expect(result.coverLetter).toBeDefined();
  });

  it('rejette un jobOfferId vide', () => {
    expect(() =>
      CreateApplicationSchema.parse({ jobOfferId: '' }),
    ).toThrow();
  });

  it('rejette un jobOfferId au format invalide (non-cuid)', () => {
    expect(() =>
      CreateApplicationSchema.parse({ jobOfferId: 'pas-un-cuid' }),
    ).toThrow();
  });

  it('rejette une lettre de motivation > 5000 caractères', () => {
    expect(() =>
      CreateApplicationSchema.parse({
        jobOfferId: validCuid,
        coverLetter: 'a'.repeat(5001),
      }),
    ).toThrow();
  });

  it('accepte une lettre de motivation exactement à 5000 caractères', () => {
    expect(() =>
      CreateApplicationSchema.parse({
        jobOfferId: validCuid,
        coverLetter: 'a'.repeat(5000),
      }),
    ).not.toThrow();
  });
});

// ─── UpdateApplicationStatusSchema ───────────────────────────────────────────

describe('UpdateApplicationStatusSchema', () => {
  it('valide le passage à VIEWED', () => {
    const result = UpdateApplicationStatusSchema.parse({ status: ApplicationStatus.VIEWED });
    expect(result.status).toBe(ApplicationStatus.VIEWED);
  });

  it('valide le passage à INTERVIEW', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({ status: ApplicationStatus.INTERVIEW }),
    ).not.toThrow();
  });

  it('valide le passage à ACCEPTED', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({ status: ApplicationStatus.ACCEPTED }),
    ).not.toThrow();
  });

  it('valide le passage à REJECTED avec note', () => {
    const result = UpdateApplicationStatusSchema.parse({
      status: ApplicationStatus.REJECTED,
      note: 'Profil ne correspond pas aux attentes.',
    });
    expect(result.note).toBe('Profil ne correspond pas aux attentes.');
  });

  it('valide WITHDRAWN (retrait par le dev)', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({ status: ApplicationStatus.WITHDRAWN }),
    ).not.toThrow();
  });

  it('rejette un statut inconnu', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({ status: 'EN_COURS' }),
    ).toThrow();
  });

  it('rejette si statut absent', () => {
    expect(() => UpdateApplicationStatusSchema.parse({})).toThrow();
  });

  it('rejette une note > 1000 caractères', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({
        status: ApplicationStatus.REJECTED,
        note: 'a'.repeat(1001),
      }),
    ).toThrow();
  });
});

// ─── ApplicationFiltersSchema ──────────────────────────────────────────────────

describe('ApplicationFiltersSchema', () => {
  it('accepte un objet vide (aucun filtre)', () => {
    expect(() => ApplicationFiltersSchema.parse({})).not.toThrow();
  });

  it('filtre par statut SENT', () => {
    const result = ApplicationFiltersSchema.parse({ status: ApplicationStatus.SENT });
    expect(result.status).toBe(ApplicationStatus.SENT);
  });

  it('filtre par jobOfferId', () => {
    const result = ApplicationFiltersSchema.parse({ jobOfferId: 'some-id' });
    expect(result.jobOfferId).toBe('some-id');
  });

  it('filtre par developerId', () => {
    const result = ApplicationFiltersSchema.parse({ developerId: 'dev-id' });
    expect(result.developerId).toBe('dev-id');
  });

  it('rejette un statut inconnu dans les filtres', () => {
    expect(() =>
      ApplicationFiltersSchema.parse({ status: 'UNKNOWN_STATUS' }),
    ).toThrow();
  });

  it('accepte une combinaison de filtres', () => {
    const result = ApplicationFiltersSchema.parse({
      status: ApplicationStatus.INTERVIEW,
      developerId: 'dev-123',
    });
    expect(result.status).toBe(ApplicationStatus.INTERVIEW);
    expect(result.developerId).toBe('dev-123');
  });
});
