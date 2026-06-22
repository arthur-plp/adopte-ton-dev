import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

export default function DeveloppeurPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="size-8 text-primary" />
        </div>
        <h1 className="mb-3 text-3xl font-bold text-foreground">
          Les profils arrivent bientôt
        </h1>
        <p className="mb-8 max-w-md text-muted-foreground">
          L&apos;annuaire des développeurs juniors sera bientôt accessible aux
          recruteurs. Pour accéder à la recherche de profils, demandez votre
          accès recruteur.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/recruteurs">
              Accès recruteur <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
