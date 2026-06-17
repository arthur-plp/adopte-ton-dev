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

    const role = (session.user as { role?: string }).role;
    if (!role || role === "DEVELOPER") {
      router.replace("/dashboard/developer");
    } else if (role === "RECRUITER") {
      router.replace("/dashboard/recruiter");
    } else if (role === "ADMIN") {
      router.replace("/dashboard/admin");
    } else {
      router.replace("/dashboard/developer");
    }
  }, [session, isPending, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
