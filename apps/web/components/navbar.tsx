"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Code2, LogOut, LayoutDashboard, ChevronDown, UserCircle,
  Briefcase, ShieldAlert, Plus, Menu, X, MessageCircle, CreditCard,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { NotificationBell } from "@/components/notification-bell";

const ROLE_LABELS: Record<string, string> = {
  DEVELOPER: "Développeur",
  RECRUITER: "Recruteur",
  ADMIN: "Admin",
};

function getDashboardUrl(role: string | null | undefined): string {
  if (role === "RECRUITER") return "/dashboard/recruiter";
  if (role === "ADMIN") return "/dashboard/admin";
  return "/dashboard/developer";
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`transition-colors ${isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </Link>
  );
}

export function Navbar() {
  const { data: session, isPending } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Le rendu serveur n'a jamais de session (composant client, pas de cookie lu en SSR),
  // alors que le client la résout souvent avant même la passe d'hydratation. Tant que
  // le composant n'a pas "monté", on retombe sur l'état invité pour que la première
  // passe client matche exactement le HTML serveur (cf. erreur d'hydratation React).
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  const user = hasMounted ? session?.user : undefined;
  const role = (user as { role?: string } | undefined)?.role ?? "";
  const dashboardUrl = getDashboardUrl(role);
  const showPending = hasMounted && isPending;

  function closeMobile() { setMobileOpen(false); }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={closeMobile}>
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
            <Code2 className="size-4 text-primary-foreground" />
          </div>
          <span className="hidden text-foreground sm:inline">Adopte Ton Dev</span>
          <span className="text-foreground sm:hidden">ATD</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-6 text-sm md:flex">
          {!user ? (
            <>
              <NavLink href="/offres">Offres</NavLink>
              <NavLink href="/recruteurs">Pour les recruteurs</NavLink>
              <NavLink href="/a-propos">À propos</NavLink>
              <NavLink href="/contact">Contact</NavLink>
            </>
          ) : role === "ADMIN" ? (
            <>
              <NavLink href="/dashboard/admin">Administration</NavLink>
              <NavLink href="/messages">Messages</NavLink>
            </>
          ) : (
            <>
              <NavLink href="/offres">Offres</NavLink>
              {role === "RECRUITER" && (
                <NavLink href="/developpeurs">Développeurs</NavLink>
              )}
              <NavLink href={dashboardUrl}>Tableau de bord</NavLink>
              <NavLink href="/messages">Messages</NavLink>
              {role === "RECRUITER" && (
                <NavLink href="/plans">Abonnement</NavLink>
              )}
              <NavLink href="/contact">Contact</NavLink>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {showPending ? (
            <div className="size-7 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <>
              <NotificationBell />
              <AuthedMenu user={user} />
            </>
          ) : (
            <GuestButtons />
          )}

          {/* Burger mobile */}
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border/60 bg-background px-4 pb-4 pt-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {!user ? (
              <>
                <MobileNavLink href="/offres" onClick={closeMobile}>Offres</MobileNavLink>
                <MobileNavLink href="/recruteurs" onClick={closeMobile}>Pour les recruteurs</MobileNavLink>
                <MobileNavLink href="/a-propos" onClick={closeMobile}>À propos</MobileNavLink>
                <MobileNavLink href="/contact" onClick={closeMobile}>Contact</MobileNavLink>
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <Link href="/sign-in" onClick={closeMobile} className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                    Se connecter
                  </Link>
                  <Link href="/sign-in?tab=signup" onClick={closeMobile} className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">
                    S&apos;inscrire
                  </Link>
                </div>
              </>
            ) : role === "ADMIN" ? (
              <>
                <MobileNavLink href="/dashboard/admin" onClick={closeMobile}>Administration</MobileNavLink>
                <MobileNavLink href="/messages" onClick={closeMobile}>Messages</MobileNavLink>
              </>
            ) : (
              <>
                <MobileNavLink href="/offres" onClick={closeMobile}>Offres</MobileNavLink>
                {role === "RECRUITER" && (
                  <MobileNavLink href="/developpeurs" onClick={closeMobile}>Développeurs</MobileNavLink>
                )}
                <MobileNavLink href={dashboardUrl} onClick={closeMobile}>Tableau de bord</MobileNavLink>
                <MobileNavLink href="/messages" onClick={closeMobile}>Messages</MobileNavLink>
                <MobileNavLink href="/profile/edit" onClick={closeMobile}>Mon profil</MobileNavLink>
                {role === "RECRUITER" && (
                  <MobileNavLink href="/jobs/new" onClick={closeMobile}>Créer une offre</MobileNavLink>
                )}
                {role === "RECRUITER" && (
                  <MobileNavLink href="/plans" onClick={closeMobile}>Abonnement</MobileNavLink>
                )}
                <MobileNavLink href="/contact" onClick={closeMobile}>Contact</MobileNavLink>
              </>
            )}
          </nav>
        </div>
      )}
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
  const dashboardUrl = getDashboardUrl(role);

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

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-md">
          {/* User info */}
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="my-1 border-t border-border" />

          {role === "ADMIN" ? (
            <>
              <DropdownItem href="/dashboard/admin" icon={<ShieldAlert className="size-4" />}>
                Administration
              </DropdownItem>
              <DropdownItem href="/messages" icon={<MessageCircle className="size-4" />}>
                Messages
              </DropdownItem>
            </>
          ) : (
            <>
              <DropdownItem href={dashboardUrl} icon={<LayoutDashboard className="size-4" />}>
                Tableau de bord
              </DropdownItem>
              <DropdownItem href="/messages" icon={<MessageCircle className="size-4" />}>
                Messages
              </DropdownItem>
              <DropdownItem href="/profile/edit" icon={<UserCircle className="size-4" />}>
                Mon profil
              </DropdownItem>
              {role === "RECRUITER" && (
                <DropdownItem href="/jobs/new" icon={<Plus className="size-4" />}>
                  Créer une offre
                </DropdownItem>
              )}
              {role === "RECRUITER" && (
                <DropdownItem href="/plans" icon={<CreditCard className="size-4" />}>
                  Abonnement
                </DropdownItem>
              )}
              {role === "DEVELOPER" && (
                <DropdownItem href="/offres" icon={<Briefcase className="size-4" />}>
                  Parcourir les offres
                </DropdownItem>
              )}
            </>
          )}

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

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      {children}
    </Link>
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
