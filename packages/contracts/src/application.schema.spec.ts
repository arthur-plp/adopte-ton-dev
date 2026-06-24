import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  ApplicationFiltersSchema,
  CreateDocumentRequestSchema,
  CreateUploadUrlSchema,
  ConfirmUploadSchema,
} from './application.schema';
import { ApplicationStatus, InterviewMode } from '@repo/types';

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

  it("valide le passage à INTERVIEW en distanciel avec un lien de visio", () => {
    const result = UpdateApplicationStatusSchema.parse({
      status: ApplicationStatus.INTERVIEW,
      interviewMode: InterviewMode.REMOTE,
      interviewLocation: 'https://meet.jit.si/abc-def-ghi',
    });
    expect(result.interviewMode).toBe(InterviewMode.REMOTE);
    expect(result.interviewLocation).toBe('https://meet.jit.si/abc-def-ghi');
  });

  it('valide le passage à INTERVIEW en présentiel avec une adresse', () => {
    const result = UpdateApplicationStatusSchema.parse({
      status: ApplicationStatus.INTERVIEW,
      interviewMode: InterviewMode.IN_PERSON,
      interviewLocation: '12 rue des Lilas, 75011 Paris',
    });
    expect(result.interviewMode).toBe(InterviewMode.IN_PERSON);
  });

  it('rejette un interviewMode inconnu', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({
        status: ApplicationStatus.INTERVIEW,
        interviewMode: 'HYBRID',
      }),
    ).toThrow();
  });

  it('rejette une interviewLocation > 500 caractères', () => {
    expect(() =>
      UpdateApplicationStatusSchema.parse({
        status: ApplicationStatus.INTERVIEW,
        interviewMode: InterviewMode.IN_PERSON,
        interviewLocation: 'a'.repeat(501),
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

// ─── CreateDocumentRequestSchema ───────────────────────────────────────────────

describe('CreateDocumentRequestSchema', () => {
  it('valide une demande avec juste un label', () => {
    const result = CreateDocumentRequestSchema.parse({ label: 'CV' });
    expect(result.label).toBe('CV');
  });

  it('valide une demande avec une note', () => {
    const result = CreateDocumentRequestSchema.parse({
      label: 'Diplôme',
      note: 'Le dernier diplôme obtenu suffit.',
    });
    expect(result.note).toBe('Le dernier diplôme obtenu suffit.');
  });

  it('rejette un label vide', () => {
    expect(() => CreateDocumentRequestSchema.parse({ label: '' })).toThrow();
  });

  it('rejette un label > 100 caractères', () => {
    expect(() =>
      CreateDocumentRequestSchema.parse({ label: 'a'.repeat(101) }),
    ).toThrow();
  });
});

// ─── CreateUploadUrlSchema ──────────────────────────────────────────────────────

describe('CreateUploadUrlSchema', () => {
  it('valide un nom de fichier, un type MIME et une taille', () => {
    const result = CreateUploadUrlSchema.parse({
      fileName: 'cv.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
    });
    expect(result.fileName).toBe('cv.pdf');
    expect(result.contentType).toBe('application/pdf');
    expect(result.fileSize).toBe(1024);
  });

  it('rejette un fileName vide', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({
        fileName: '',
        contentType: 'application/pdf',
        fileSize: 1024,
      }),
    ).toThrow();
  });

  it('rejette si contentType est absent', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({ fileName: 'cv.pdf', fileSize: 1024 }),
    ).toThrow();
  });

  it('rejette si fileSize est absent', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({
        fileName: 'cv.pdf',
        contentType: 'application/pdf',
      }),
    ).toThrow();
  });

  it('rejette un fileSize au-delà de la limite (10 Mo)', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({
        fileName: 'gros-fichier.pdf',
        contentType: 'application/pdf',
        fileSize: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow();
  });

  it('accepte exactement la limite de 10 Mo', () => {
    const result = CreateUploadUrlSchema.parse({
      fileName: 'cv.pdf',
      contentType: 'application/pdf',
      fileSize: 10 * 1024 * 1024,
    });
    expect(result.fileSize).toBe(10 * 1024 * 1024);
  });

  it('rejette un fileSize négatif ou nul', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({
        fileName: 'cv.pdf',
        contentType: 'application/pdf',
        fileSize: 0,
      }),
    ).toThrow();
  });

  it('accepte les types MIME autorisés (PDF, PNG, JPEG)', () => {
    for (const contentType of ['application/pdf', 'image/png', 'image/jpeg']) {
      expect(() =>
        CreateUploadUrlSchema.parse({
          fileName: 'doc.bin',
          contentType,
          fileSize: 1024,
        }),
      ).not.toThrow();
    }
  });

  it('rejette un type MIME non autorisé (ex. text/html)', () => {
    expect(() =>
      CreateUploadUrlSchema.parse({
        fileName: 'fichier.html',
        contentType: 'text/html',
        fileSize: 1024,
      }),
    ).toThrow();
  });
});

// ─── ConfirmUploadSchema ────────────────────────────────────────────────────────

describe('ConfirmUploadSchema', () => {
  it('valide une confirmation avec fileKey et fileName', () => {
    const result = ConfirmUploadSchema.parse({
      fileKey: 'applications/app-1/req-1/123-cv.pdf',
      fileName: 'cv.pdf',
    });
    expect(result.fileKey).toBe('applications/app-1/req-1/123-cv.pdf');
  });

  it('rejette si fileKey est absent', () => {
    expect(() => ConfirmUploadSchema.parse({ fileName: 'cv.pdf' })).toThrow();
  });
});
