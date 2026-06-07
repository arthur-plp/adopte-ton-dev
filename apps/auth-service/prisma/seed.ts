import 'dotenv/config';
import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] ?? '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TECHNICAL_SKILLS = [
  // Pratiques web
  'API REST', 'Authentification OAuth',
  // Architecture & conception
  'Architecture MVC', 'Micro-services', 'Design patterns', 'Clean Architecture',
  // Qualité & méthodes
  'Tests unitaires', "Tests d'intégration", 'TDD', 'CI/CD', 'Agile / Scrum',
  // Base de données (concepts)
  'Modélisation de BDD', 'ORM', 'NoSQL',
  // Bonnes pratiques
  'Code review', 'Documentation technique', 'Débogage', 'Performance web',
];
// Note : Git, Docker, Linux, GraphQL sont dans le catalogue Technologies (outils concrets)

const SOFT_SKILLS = [
  'Communication',
  'Travail en équipe',
  'Autonomie',
  'Adaptabilité',
  'Résolution de problèmes',
  'Gestion du temps',
  'Curiosité',
  'Esprit d\'analyse',
  'Créativité',
  'Prise d\'initiative',
  'Rigueur',
  'Gestion du stress',
];

async function main() {
  console.log('Seeding skills catalog...');

  for (const name of TECHNICAL_SKILLS) {
    await prisma.skill.upsert({
      where: { name },
      update: { category: 'technique' },
      create: { name, category: 'technique' },
    });
  }

  for (const name of SOFT_SKILLS) {
    await prisma.skill.upsert({
      where: { name },
      update: { category: 'soft' },
      create: { name, category: 'soft' },
    });
  }

  const total = TECHNICAL_SKILLS.length + SOFT_SKILLS.length;
  console.log(`✓ ${total} skills insérés (${TECHNICAL_SKILLS.length} techniques, ${SOFT_SKILLS.length} soft)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
