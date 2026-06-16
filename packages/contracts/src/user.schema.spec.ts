import {
  CreateUserSchema,
  CreateDeveloperProfileSchema,
  UpdateDeveloperProfileSchema,
  OnboardingSchema,
  CreateRecruiterProfileSchema,
  CreateCompanySchema,
  TechnologySchema,
  ProjectSchema,
  SkillSchema,
} from './user.schema';
import { Role, Availability, SkillLevel } from '@repo/types';

// ─── CreateUserSchema ────────────────────────────────────────────────────────

describe('CreateUserSchema', () => {
  it('valide un user complet correct', () => {
    expect(() =>
      CreateUserSchema.parse({ email: 'dev@test.com', role: Role.DEVELOPER, authProvider: 'github' }),
    ).not.toThrow();
  });

  it('accepte le provider google', () => {
    expect(() =>
      CreateUserSchema.parse({ email: 'rec@test.com', role: Role.RECRUITER, authProvider: 'google' }),
    ).not.toThrow();
  });

  it('rejette un email invalide', () => {
    expect(() =>
      CreateUserSchema.parse({ email: 'pas-un-email', role: Role.DEVELOPER, authProvider: 'github' }),
    ).toThrow();
  });

  it('rejette un rôle inconnu', () => {
    expect(() =>
      CreateUserSchema.parse({ email: 'x@x.com', role: 'SUPER_ADMIN', authProvider: 'github' }),
    ).toThrow();
  });

  it('rejette un provider non supporté', () => {
    expect(() =>
      CreateUserSchema.parse({ email: 'x@x.com', role: Role.DEVELOPER, authProvider: 'twitter' }),
    ).toThrow();
  });
});

// ─── CreateDeveloperProfileSchema ─────────────────────────────────────────────

describe('CreateDeveloperProfileSchema', () => {
  const valid = {
    firstName: 'Alice',
    lastName: 'Dev',
    remoteOk: false,
    availability: Availability.IMMEDIATE,
  };

  it('valide un profil minimal', () => {
    expect(() => CreateDeveloperProfileSchema.parse(valid)).not.toThrow();
  });

  it('accepte des champs optionnels valides', () => {
    const result = CreateDeveloperProfileSchema.parse({
      ...valid,
      title: 'Développeur Fullstack',
      githubUrl: 'https://github.com/alice',
      portfolioUrl: 'https://alice.dev',
      linkedinUrl: 'https://linkedin.com/in/alice',
      bio: 'Passionnée de TypeScript',
      location: 'Paris',
    });
    expect(result.title).toBe('Développeur Fullstack');
    expect(result.githubUrl).toBe('https://github.com/alice');
  });

  it('applique remoteOk=false par défaut', () => {
    const { remoteOk: _r, ...withoutRemote } = valid;
    expect(CreateDeveloperProfileSchema.parse(withoutRemote).remoteOk).toBe(false);
  });

  it('applique availability=IMMEDIATE par défaut', () => {
    const { availability: _a, ...withoutAvail } = valid;
    expect(CreateDeveloperProfileSchema.parse(withoutAvail).availability).toBe(Availability.IMMEDIATE);
  });

  it('rejette un firstName vide', () => {
    expect(() => CreateDeveloperProfileSchema.parse({ ...valid, firstName: '' })).toThrow();
  });

  it('rejette un lastName vide', () => {
    expect(() => CreateDeveloperProfileSchema.parse({ ...valid, lastName: '' })).toThrow();
  });

  it('rejette une githubUrl invalide', () => {
    expect(() =>
      CreateDeveloperProfileSchema.parse({ ...valid, githubUrl: 'pas-une-url' }),
    ).toThrow();
  });

  it('rejette une portfolioUrl invalide', () => {
    expect(() =>
      CreateDeveloperProfileSchema.parse({ ...valid, portfolioUrl: 'ftp://mauvais' }),
    ).not.toThrow(); // ftp:// est une URL valide selon Zod
    expect(() =>
      CreateDeveloperProfileSchema.parse({ ...valid, portfolioUrl: 'pas-une-url' }),
    ).toThrow();
  });

  it('rejette un title trop long (> 200 caractères)', () => {
    expect(() =>
      CreateDeveloperProfileSchema.parse({ ...valid, title: 'a'.repeat(201) }),
    ).toThrow();
  });
});

// ─── UpdateDeveloperProfileSchema ─────────────────────────────────────────────

describe('UpdateDeveloperProfileSchema', () => {
  it('accepte un objet vide (tous les champs optionnels)', () => {
    expect(() => UpdateDeveloperProfileSchema.parse({})).not.toThrow();
  });

  it('accepte une mise à jour partielle (firstName seul)', () => {
    const result = UpdateDeveloperProfileSchema.parse({ firstName: 'Bob' });
    expect(result.firstName).toBe('Bob');
  });

  it('rejette une portfolioUrl invalide même en update', () => {
    expect(() =>
      UpdateDeveloperProfileSchema.parse({ portfolioUrl: 'pas-une-url' }),
    ).toThrow();
  });

  it('accepte availability valide', () => {
    const result = UpdateDeveloperProfileSchema.parse({ availability: Availability.NOT_LOOKING });
    expect(result.availability).toBe(Availability.NOT_LOOKING);
  });
});

// ─── CreateCompanySchema ──────────────────────────────────────────────────────

describe('CreateCompanySchema', () => {
  it('valide une entreprise minimale (nom seul)', () => {
    expect(() => CreateCompanySchema.parse({ name: 'Acme Corp' })).not.toThrow();
  });

  it('accepte website et description', () => {
    const result = CreateCompanySchema.parse({
      name: 'Acme',
      website: 'https://acme.io',
      description: 'Une super boîte',
    });
    expect(result.website).toBe('https://acme.io');
  });

  it('rejette un nom vide', () => {
    expect(() => CreateCompanySchema.parse({ name: '' })).toThrow();
  });

  it('rejette un website invalide', () => {
    expect(() => CreateCompanySchema.parse({ name: 'Acme', website: 'pas-une-url' })).toThrow();
  });
});

// ─── CreateRecruiterProfileSchema ─────────────────────────────────────────────

describe('CreateRecruiterProfileSchema', () => {
  const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

  it('valide un profil recruteur correct', () => {
    expect(() =>
      CreateRecruiterProfileSchema.parse({
        firstName: 'Bob',
        lastName: 'Rec',
        companyId: validCuid,
      }),
    ).not.toThrow();
  });

  it('rejette un firstName vide', () => {
    expect(() =>
      CreateRecruiterProfileSchema.parse({ firstName: '', lastName: 'Rec', companyId: validCuid }),
    ).toThrow();
  });

  it('rejette un companyId vide', () => {
    expect(() =>
      CreateRecruiterProfileSchema.parse({ firstName: 'Bob', lastName: 'Rec', companyId: '' }),
    ).toThrow();
  });

  it('rejette un companyId au format invalide (non-cuid)', () => {
    expect(() =>
      CreateRecruiterProfileSchema.parse({ firstName: 'Bob', lastName: 'Rec', companyId: 'pas-un-cuid' }),
    ).toThrow();
  });
});

// ─── TechnologySchema ─────────────────────────────────────────────────────────

describe('TechnologySchema', () => {
  it('valide une techno complète', () => {
    const result = TechnologySchema.parse({ name: 'TypeScript', level: SkillLevel.ADVANCED });
    expect(result.name).toBe('TypeScript');
    expect(result.level).toBe(SkillLevel.ADVANCED);
  });

  it('applique level=INTERMEDIATE par défaut', () => {
    const result = TechnologySchema.parse({ name: 'React' });
    expect(result.level).toBe(SkillLevel.INTERMEDIATE);
  });

  it('rejette un nom vide', () => {
    expect(() => TechnologySchema.parse({ name: '' })).toThrow();
  });
});

// ─── ProjectSchema ────────────────────────────────────────────────────────────

describe('ProjectSchema', () => {
  const valid = {
    title: 'Mon Portfolio',
    description: 'Un projet sympa',
    technologies: ['TypeScript', 'React'],
  };

  it('valide un projet correct', () => {
    expect(() => ProjectSchema.parse(valid)).not.toThrow();
  });

  it('technologies vide par défaut', () => {
    const { technologies: _t, ...withoutTech } = valid;
    expect(ProjectSchema.parse(withoutTech).technologies).toEqual([]);
  });

  it('rejette un titre vide', () => {
    expect(() => ProjectSchema.parse({ ...valid, title: '' })).toThrow();
  });

  it('rejette une description vide', () => {
    expect(() => ProjectSchema.parse({ ...valid, description: '' })).toThrow();
  });

  it('rejette une repoUrl invalide', () => {
    expect(() =>
      ProjectSchema.parse({ ...valid, repoUrl: 'pas-une-url' }),
    ).toThrow();
  });
});

// ─── OnboardingSchema (discriminatedUnion) ────────────────────────────────────

describe('OnboardingSchema', () => {
  it('valide un onboarding DEVELOPER', () => {
    expect(() =>
      OnboardingSchema.parse({
        role: Role.DEVELOPER,
        profile: {
          firstName: 'Alice',
          lastName: 'Dev',
          remoteOk: false,
          availability: Availability.IMMEDIATE,
        },
      }),
    ).not.toThrow();
  });

  it('valide un onboarding RECRUITER avec companyId', () => {
    expect(() =>
      OnboardingSchema.parse({
        role: Role.RECRUITER,
        profile: {
          firstName: 'Bob',
          lastName: 'Rec',
          companyId: 'clxxxxxxxxxxxxxxxxxxxxxxxx',
        },
      }),
    ).not.toThrow();
  });

  it('rejette un onboarding DEVELOPER sans profil', () => {
    expect(() => OnboardingSchema.parse({ role: Role.DEVELOPER })).toThrow();
  });

  it('rejette un onboarding avec rôle invalide', () => {
    expect(() =>
      OnboardingSchema.parse({
        role: 'UNKNOWN',
        profile: { firstName: 'X', lastName: 'Y' },
      }),
    ).toThrow();
  });
});
