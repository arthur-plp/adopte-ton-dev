import {
  CreateJobOfferSchema,
  UpdateJobOfferSchema,
  JobOfferFiltersSchema,
  JobOfferResponseSchema,
  PaginatedJobOffersSchema,
  AdminCreateJobOfferSchema,
} from './job.schema';
import { JobType, JobStatus } from '@repo/types';

const validBase = {
  title: 'Développeur Fullstack TypeScript',
  description: 'Description longue du poste qui fait au moins 10 caractères',
  type: JobType.INTERNSHIP,
};

// ─── CreateJobOfferSchema ─────────────────────────────────────────────────────

describe('CreateJobOfferSchema', () => {
  it('valide une offre minimale valide', () => {
    expect(() => CreateJobOfferSchema.parse(validBase)).not.toThrow();
  });

  it('valide les 3 types d\'offres', () => {
    for (const type of [JobType.INTERNSHIP, JobType.APPRENTICESHIP, JobType.FIRST_JOB]) {
      expect(() => CreateJobOfferSchema.parse({ ...validBase, type })).not.toThrow();
    }
  });

  it('valide une offre complète avec salaire et technos', () => {
    const result = CreateJobOfferSchema.parse({
      ...validBase,
      location: 'Paris',
      remoteOk: true,
      requiredTechnologies: ['TypeScript', 'React', 'Node.js'],
      salaryMin: 1500,
      salaryMax: 2000,
      isPublic: true,
    });
    expect(result.requiredTechnologies).toHaveLength(3);
    expect(result.salaryMin).toBe(1500);
  });

  it('rejette un titre vide', () => {
    expect(() => CreateJobOfferSchema.parse({ ...validBase, title: '' })).toThrow();
  });

  it('rejette une description trop courte (< 10 caractères)', () => {
    expect(() => CreateJobOfferSchema.parse({ ...validBase, description: 'Court' })).toThrow();
  });

  it('rejette un type d\'offre inconnu', () => {
    expect(() => CreateJobOfferSchema.parse({ ...validBase, type: 'CDI' })).toThrow();
  });

  it('rejette un salaire négatif', () => {
    expect(() =>
      CreateJobOfferSchema.parse({ ...validBase, salaryMin: -100 }),
    ).toThrow();
  });

  it('rejette salaryMin > salaryMax (validation croisée)', () => {
    expect(() =>
      CreateJobOfferSchema.parse({ ...validBase, salaryMin: 3000, salaryMax: 1500 }),
    ).toThrow();
  });

  it('accepte salaryMin === salaryMax', () => {
    expect(() =>
      CreateJobOfferSchema.parse({ ...validBase, salaryMin: 2000, salaryMax: 2000 }),
    ).not.toThrow();
  });

  it('applique remoteOk=false par défaut', () => {
    const result = CreateJobOfferSchema.parse(validBase);
    expect(result.remoteOk).toBe(false);
  });

  it('applique isPublic=true par défaut', () => {
    const result = CreateJobOfferSchema.parse(validBase);
    expect(result.isPublic).toBe(true);
  });

  it('applique requiredTechnologies=[] par défaut', () => {
    const result = CreateJobOfferSchema.parse(validBase);
    expect(result.requiredTechnologies).toEqual([]);
  });
});

// ─── AdminCreateJobOfferSchema ────────────────────────────────────────────────

describe('AdminCreateJobOfferSchema', () => {
  it('valide une offre avec recruiterId/companyId explicites', () => {
    const result = AdminCreateJobOfferSchema.parse({
      ...validBase,
      recruiterId: 'recruiter-1',
      companyId: 'company-1',
      companyName: 'Acme',
    });
    expect(result.recruiterId).toBe('recruiter-1');
    expect(result.companyId).toBe('company-1');
  });

  it('rejette si recruiterId est absent', () => {
    expect(() =>
      AdminCreateJobOfferSchema.parse({ ...validBase, companyId: 'company-1' }),
    ).toThrow();
  });

  it('rejette si companyId est absent', () => {
    expect(() =>
      AdminCreateJobOfferSchema.parse({ ...validBase, recruiterId: 'recruiter-1' }),
    ).toThrow();
  });

  it('rejette si salaryMin > salaryMax (même règle que CreateJobOfferSchema)', () => {
    expect(() =>
      AdminCreateJobOfferSchema.parse({
        ...validBase,
        recruiterId: 'recruiter-1',
        companyId: 'company-1',
        salaryMin: 2000,
        salaryMax: 1000,
      }),
    ).toThrow();
  });
});

// ─── UpdateJobOfferSchema ─────────────────────────────────────────────────────

describe('UpdateJobOfferSchema', () => {
  it('accepte un objet vide (tous les champs optionnels)', () => {
    expect(() => UpdateJobOfferSchema.parse({})).not.toThrow();
  });

  it('accepte une mise à jour partielle (titre seul)', () => {
    const result = UpdateJobOfferSchema.parse({ title: 'Nouveau titre' });
    expect(result.title).toBe('Nouveau titre');
  });

  it('rejette un titre vide même en update', () => {
    expect(() => UpdateJobOfferSchema.parse({ title: '' })).toThrow();
  });

  it('rejette salaryMin > salaryMax en update aussi', () => {
    expect(() =>
      UpdateJobOfferSchema.parse({ salaryMin: 5000, salaryMax: 1000 }),
    ).toThrow();
  });

  it('accepte la mise à jour du type en FIRST_JOB', () => {
    const result = UpdateJobOfferSchema.parse({ type: JobType.FIRST_JOB });
    expect(result.type).toBe(JobType.FIRST_JOB);
  });
});

// ─── JobOfferFiltersSchema ────────────────────────────────────────────────────

describe('JobOfferFiltersSchema', () => {
  it('accepte un objet vide (aucun filtre)', () => {
    expect(() => JobOfferFiltersSchema.parse({})).not.toThrow();
  });

  it('filtre par type', () => {
    const result = JobOfferFiltersSchema.parse({ type: JobType.APPRENTICESHIP });
    expect(result.type).toBe(JobType.APPRENTICESHIP);
  });

  it('filtre par statut', () => {
    const result = JobOfferFiltersSchema.parse({ status: JobStatus.PUBLISHED });
    expect(result.status).toBe(JobStatus.PUBLISHED);
  });

  it('filtre par remoteOk (coerce string "true" → true)', () => {
    const result = JobOfferFiltersSchema.parse({ remoteOk: 'true' });
    expect(result.remoteOk).toBe(true);
  });

  it('filtre par remoteOk (coerce string "false" → false)', () => {
    const result = JobOfferFiltersSchema.parse({ remoteOk: 'false' });
    expect(result.remoteOk).toBe(false);
  });

  it('accepte un filtre par technologies (tableau)', () => {
    const result = JobOfferFiltersSchema.parse({ technologies: ['TypeScript', 'React'] });
    expect(result.technologies).toHaveLength(2);
  });

  it("normalise technologies en tableau quand une seule valeur est fournie (qs ne renvoie pas un tableau à un seul élément)", () => {
    const result = JobOfferFiltersSchema.parse({ technologies: 'TypeScript' });
    expect(result.technologies).toEqual(['TypeScript']);
  });

  it('rejette un type d\'offre inconnu dans les filtres', () => {
    expect(() => JobOfferFiltersSchema.parse({ type: 'FREELANCE' })).toThrow();
  });
});

// ─── JobOfferResponseSchema ───────────────────────────────────────────────────

describe('JobOfferResponseSchema', () => {
  const validResponse = {
    id: 'cuid123',
    companyId: 'company1',
    companyName: 'Acme SAS',
    recruiterId: 'recruiter1',
    title: 'Développeur Fullstack',
    description: 'Description du poste',
    type: JobType.INTERNSHIP,
    status: JobStatus.PUBLISHED,
    isPublic: true,
    location: 'Paris',
    country: 'France',
    remoteOk: false,
    requiredTechnologies: ['TypeScript', 'React'],
    requiredTechLevels: null,
    salaryMin: 1500,
    salaryMax: 2000,
    rejectionReason: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('valide une réponse complète', () => {
    expect(() => JobOfferResponseSchema.parse(validResponse)).not.toThrow();
  });

  it('accepte location, salaires et publishedAt null', () => {
    const result = JobOfferResponseSchema.parse({
      ...validResponse,
      location: null,
      salaryMin: null,
      salaryMax: null,
      publishedAt: null,
    });
    expect(result.location).toBeNull();
    expect(result.salaryMin).toBeNull();
    expect(result.publishedAt).toBeNull();
  });

  it('coerce les dates ISO string en Date', () => {
    const result = JobOfferResponseSchema.parse(validResponse);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('rejette si id manquant', () => {
    const { id: _, ...withoutId } = validResponse;
    expect(() => JobOfferResponseSchema.parse(withoutId)).toThrow();
  });
});

// ─── PaginatedJobOffersSchema ─────────────────────────────────────────────────

describe('PaginatedJobOffersSchema', () => {
  it('valide une réponse paginée vide', () => {
    expect(() => PaginatedJobOffersSchema.parse({
      data: [], total: 0, page: 1, pageSize: 20,
    })).not.toThrow();
  });

  it('rejette total négatif', () => {
    expect(() => PaginatedJobOffersSchema.parse({
      data: [], total: -1, page: 1, pageSize: 20,
    })).toThrow();
  });
});
