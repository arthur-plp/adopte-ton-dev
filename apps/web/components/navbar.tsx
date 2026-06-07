"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Code2, LogOut, LayoutDashboard, ChevronDown, UserCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: "Développeur",
  RECRUITER: "Recruteur",
  ADMIN: "Admin",
};

export function Navbar() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
            <Code2 className="size-4 text-primary-foreground" />
          </div>
          <span className="hidden text-foreground sm:inline">Adopte Ton Dev</span>
          <span className="text-foreground sm:hidden">ATD</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {user ? (
            <>
              <Link href="/dashboard/developer" className="hover:text-foreground transition-colors">
                Tableau de bord
              </Link>
              <Link href="/recruteurs" className="hover:text-foreground transition-colors">
                Recruteurs
              </Link>
              <Link href="/a-propos" className="hover:text-foreground transition-colors">
                À propos
              </Link>
            </>
          ) : (
            <>
              <Link href="/#fonctionnalites" className="hover:text-foreground transition-colors">
                Fonctionnalités
              </Link>
              <Link href="/#comment-ca-marche" className="hover:text-foreground transition-colors">
                Comment ça marche
              </Link>
              <Link href="/recruteurs" className="hover:text-foreground transition-colors">
                Recruteurs
              </Link>
              <Link href="/a-propos" className="hover:text-foreground transition-colors">
                À propos
              </Link>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="size-7 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <AuthedMenu user={user} />
          ) : (
            <GuestButtons />
          )}
        </div>
      </nav>
    </header>
  );
}

function GuestButtons() {
  return (
    <>
      <Link
        href="/sign-in"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Se connecter
      </Link>
      <Button asChild size="sm">
        <Link href="/sign-in?tab=signup">S&apos;inscrire</Link>
      </Button>
    </>
  );
}

type UserLike = {
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
};

function useProfileAvatar(loggedIn: boolean) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

  useEffect(() => {
    if (!loggedIn) return;

    function fetchAvatar() {
      fetch(`${apiUrl}/users/me/profile`, { credentials: "include" })
        .then((r) => r.json())
        .then((data: unknown) => {
          const d = data as { profile?: { avatarUrl?: string | null } };
          setAvatarUrl(d?.profile?.avatarUrl ?? null);
        })
        .catch(() => {});
    }

    fetchAvatar();

    window.addEventListener("profile:avatar-updated", fetchAvatar);
    return () => window.removeEventListener("profile:avatar-updated", fetchAvatar);
  }, [loggedIn, apiUrl]);

  return avatarUrl;
}

function AuthedMenu({ user }: { user: UserLike }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const profileAvatar = useProfileAvatar(true);

  // Fermeture au clic extérieur
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const role = (user.role as string | null | undefined) ?? "";
  const roleLabel = ROLE_LABELS[role] ?? role;

  async function handleSignOut() {
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted"
      >
        {/* Avatar */}
        {profileAvatar ?? user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(profileAvatar ?? user.image) as string}
            alt={user.name}
            className="size-6 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials}
          </div>
        )}
        <span className="hidden max-w-24 truncate sm:block">{user.name.split(" ")[0]}</span>
        {roleLabel && (
          <span className="hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary sm:inline">
            {roleLabel}
          </span>
        )}
        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-md">
          {/* User info */}
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />

          <DropdownItem href="/dashboard" icon={<LayoutDashboard className="size-4" />}>
            Tableau de bord
          </DropdownItem>
          <DropdownItem href="/profile/edit" icon={<UserCircle className="size-4" />}>
            Mon profil
          </DropdownItem>

          <div className="my-1 border-t border-border" />

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </Link>
  );
}
