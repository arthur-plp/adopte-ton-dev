import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function MentionsLegalesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Mentions légales
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Dernière mise à jour : juin 2026
        </p>

        <div className="prose prose-sm max-w-none text-foreground/80 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-relaxed">
          <h2>Éditeur du site</h2>
          <p>
            Le site Adopte Ton Dev est édité par :<br />
            <strong>Arthur Philippe</strong><br />
            Étudiant — projet pédagogique<br />
            Email :{" "}
            <Link
              href="mailto:arthur.philippe21@gmail.com"
              className="text-primary hover:underline"
            >
              arthur.philippe21@gmail.com
            </Link>
          </p>

          <h2>Hébergement</h2>
          <p>
            Le site est hébergé sur un serveur privé virtuel (VPS). Le
            front-end est une application Next.js servie via Nginx avec
            certificat SSL Let&apos;s Encrypt (Certbot).
          </p>

          <h2>Directeur de la publication</h2>
          <p>Arthur Philippe</p>

          <h2>Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des contenus présents sur ce site (textes, images,
            logo, code) est protégé par le droit d&apos;auteur. Toute
            reproduction, même partielle, est interdite sans autorisation
            préalable écrite de l&apos;éditeur.
          </p>

          <h2>Limitation de responsabilité</h2>
          <p>
            L&apos;éditeur s&apos;efforce de maintenir le site accessible et à
            jour, mais ne garantit pas l&apos;absence d&apos;interruptions ou
            d&apos;erreurs. Les liens vers des sites tiers sont fournis à titre
            informatif ; l&apos;éditeur n&apos;est pas responsable de leur
            contenu.
          </p>

          <h2>Droit applicable</h2>
          <p>
            Le présent site est soumis au droit français. Tout litige relatif à
            son utilisation relève de la compétence exclusive des tribunaux
            français.
          </p>

          <h2>Contact</h2>
          <p>
            Pour toute question :{" "}
            <Link
              href="mailto:arthur.philippe21@gmail.com"
              className="text-primary hover:underline"
            >
              arthur.philippe21@gmail.com
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
