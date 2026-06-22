/**
 * Seed de production — crée le compte admin initial
 *
 * Usage :
 *   cd apps/web
 *   DATABASE_URL="postgresql://..." \
 *   BETTER_AUTH_SECRET="..." \
 *   SEED_ADMIN_EMAIL="ton@email.com" \
 *   SEED_ADMIN_PASSWORD="MotDePasseFort!" \
 *   SEED_ADMIN_NAME="Arthur Philippe" \
 *   pnpm seed:prod
 *
 * Variables d'env nécessaires :
 *   DATABASE_URL         — connexion PostgreSQL (atd_users)
 *   BETTER_AUTH_SECRET   — même secret que la prod
 *   SEED_ADMIN_EMAIL     — email du compte admin
 *   SEED_ADMIN_PASSWORD  — mot de passe (min 8 chars)
 *   SEED_ADMIN_NAME      — nom affiché (optionnel, défaut : "Admin")
 */

import { getAuth } from "../lib/auth.js";

const email    = process.env.SEED_ADMIN_EMAIL ?? "";
const password = process.env.SEED_ADMIN_PASSWORD ?? "";
const name     = process.env.SEED_ADMIN_NAME ?? "Admin";

if (!email || !password) {
  console.error("❌  SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont requis.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("❌  SEED_ADMIN_PASSWORD doit faire au moins 8 caractères.");
  process.exit(1);
}

async function main() {
  console.log(`\n🌱  Création du compte admin pour ${email}…`);

  const auth = getAuth();

  const result = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      data: {
        role: "ADMIN",
        onboarded: true,
      },
    },
  });

  console.log(`✅  Admin créé :`);
  console.log(`    ID    : ${result.user.id}`);
  console.log(`    Email : ${result.user.email}`);
  console.log(`    Nom   : ${result.user.name}`);
  console.log(`\n💡  Tu peux maintenant te connecter sur /sign-in avec ces identifiants.`);
  console.log(`    Pense à changer le mot de passe via l'interface.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌  Erreur : ${message}\n`);

    if (message.includes("already exists") || message.includes("UNIQUE")) {
      console.error("   → Un compte existe déjà avec cet email.");
    }
    if (message.includes("connect") || message.includes("ECONNREFUSED")) {
      console.error("   → Impossible de joindre la base de données. Vérifie DATABASE_URL.");
    }

    process.exit(1);
  });
