"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function DashboardRedirect() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session) { router.replace("/sign-in"); return; }

    if (typeof window !== "undefined" && localStorage.getItem("showWelcome") === "1") {
      localStorage.removeItem("showWelcome");
      toast.success("Connexion réussie !", { description: "Bienvenue sur Adopte Ton Dev." });
    }

    const { role, onboarded } = session.user as { role?: string; onboarded?: boolean };

    async function redirect() {
      // Un développeur qui se connecte pour la première fois (OAuth ou
      // email/mot de passe) n'a encore aucun DeveloperProfile : la session
      // BetterAuth existe déjà, mais le profil métier (auth-service) ne
      // l'est pas. Les recruteurs sont déjà onboardés à la création de leur
      // compte (admin), donc seul le cas développeur est concerné ici.
      if (!onboarded && role !== "RECRUITER" && role !== "ADMIN") {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
        await fetch(`${apiUrl}/users/onboarding`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "DEVELOPER" }),
        }).catch(() => {});
      }

      if (role === "RECRUITER") {
        router.replace("/dashboard/recruiter");
      } else if (role === "ADMIN") {
        router.replace("/dashboard/admin");
      } else {
        router.replace("/dashboard/developer");
      }
    }

    void redirect();
  }, [session, isPending, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
