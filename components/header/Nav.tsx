/*
path :           components/header/Nav.tsx
tag :            ["header", "nav", "navigation", "ui", "responsive"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Navigation principale du header. Affiche NAV_SECTIONS
                 côté desktop (md+) avec NavigationMenu Base UI et
                 dropdown en grille pour les items ayant des children,
                 et en Sheet drawer côté mobile (< md) avec sections
                 titrées et items repliables. Un séparateur visuel
                 (rendu en <li> direct, comme les items, pour respecter
                 le HTML : <ul> ne peut contenir que des <li>) distingue
                 les sections publique et admin sur desktop.

flow:            Reçoit className optionnel → usePathname() → rend
                 NavigationMenu (hidden md:flex) et MobileNav
                 (md:hidden). Pour chaque section : rend les items
                 (NavItemDesktop retourne déjà un <li>) + un <li
                 aria-hidden> contenant un Separator vertical entre
                 sections. NavItemDesktop : si pas de children →
                 NavigationMenuLink. Si children → NavigationMenuTrigger
                 + NavigationMenuContent (grille 1 col < sm, 2 cols ≥ sm,
                 cartes icône + titre + description + badge optionnel).
                 NavItemMobile : Link + bouton chevron (aria-expanded) +
                 liste repliable + badges. À la navigation, la Sheet se
                 ferme.

ecosystem:       Header = [
                   "@/components/header/Nav.tsx",
                   "@/components/header/dataNav.ts",
                 ]

relatedFiles:    ["@/components/header/dataNav.ts",
                  "@/components/ui/navigation-menu",
                  "@/components/ui/sheet",
                  "@/components/ui/button",
                  "@/components/ui/badge",
                  "@/components/ui/separator"]

imports:         ["next/link",
                  "next/navigation",
                  "react",
                  "lucide-react",
                  "@/lib/utils",
                  "@/components/header/dataNav",
                  "@/components/ui/badge",
                  "@/components/ui/button",
                  "@/components/ui/navigation-menu",
                  "@/components/ui/separator",
                  "@/components/ui/sheet"]

exports:         ["Nav", "NavProps"]

useBy:           ["@/components/header/Header.tsx"]

userStories:     ["*en tant qu'utilisateur je veux une navigation responsive et hiérarchisée"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : usePathname, useState (drawer + repli mobile), interactions.

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAV_SECTIONS,
  type NavChild,
  type NavItem,
} from "@/components/header/dataNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface NavProps {
  readonly className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers purs                                                       */
/* ------------------------------------------------------------------ */

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isChildActive(child: NavChild, pathname: string): boolean {
  if (child.href === "/") return pathname === "/";
  // Un child « /admin » (dashboard) doit être actif uniquement sur /admin exact.
  if (child.href === "/admin") return pathname === "/admin";
  return pathname === child.href || pathname.startsWith(`${child.href}/`);
}

/* ------------------------------------------------------------------ */
/*  Badge helper                                                       */
/* ------------------------------------------------------------------ */

function ItemBadge({
  badge,
  variant = "secondary",
}: {
  readonly badge: string;
  readonly variant?: "destructive" | "outline" | "secondary";
}) {
  return (
    <Badge variant={variant} className="ml-auto shrink-0 text-[10px]">
      {badge}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Desktop — NavigationMenu                                           */
/* ------------------------------------------------------------------ */

function NavItemDesktop({
  item,
  pathname,
}: {
  readonly item: NavItem;
  readonly pathname: string;
}) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  const hasChildren = Boolean(item.children && item.children.length > 0);

  if (!hasChildren) {
    return (
      <NavigationMenuItem>
        <NavigationMenuLink
          render={<Link href={item.href} />}
          aria-current={active ? "page" : undefined}
          className={cn(
            navigationMenuTriggerStyle(),
            active && "bg-muted/50 text-foreground",
          )}
        >
          {Icon && <Icon className="size-4" aria-hidden />}
          {item.label}
        </NavigationMenuLink>
      </NavigationMenuItem>
    );
  }

  return (
    <NavigationMenuItem value={item.href}>
      <NavigationMenuTrigger className={cn(active && "text-foreground")}>
        {Icon && <Icon className="size-4" aria-hidden />}
        {item.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[320px] gap-1 p-2 sm:w-[440px] sm:grid-cols-2">
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isChildActive(child, pathname);
            return (
              <li key={child.href}>
                <NavigationMenuLink
                  render={<Link href={child.href} />}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3 outline-none transition-colors",
                    "hover:bg-muted/60 focus-visible:bg-muted/60",
                    childActive && "bg-muted/60",
                  )}
                >
                  {ChildIcon && (
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/50 text-muted-foreground">
                      <ChildIcon className="size-4" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-medium text-foreground">
                        {child.label}
                      </span>
                      {child.badge && (
                        <ItemBadge
                          badge={child.badge}
                          variant={child.badgeVariant}
                        />
                      )}
                    </span>
                    {child.description && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {child.description}
                      </span>
                    )}
                  </span>
                </NavigationMenuLink>
              </li>
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile — Sheet                                                     */
/* ------------------------------------------------------------------ */

function NavItemMobile({
  item,
  pathname,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly pathname: string;
  readonly onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const [expanded, setExpanded] = useState<boolean>(active && hasChildren);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
            active
              ? "bg-muted/60 text-foreground"
              : "text-foreground/80 hover:text-foreground",
          )}
        >
          {Icon && <Icon className="size-4" aria-hidden />}
          {item.label}
        </Link>
        {hasChildren && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={
              expanded ? `Replier ${item.label}` : `Déplier ${item.label}`
            }
            aria-expanded={expanded}
          >
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </Button>
        )}
      </div>

      {hasChildren && expanded && (
        <ul className="ml-4 space-y-1 border-l border-border/60 pl-4">
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isChildActive(child, pathname);
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                    childActive
                      ? "bg-muted/60 font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ChildIcon && <ChildIcon className="size-4" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  {child.badge && (
                    <ItemBadge
                      badge={child.badge}
                      variant={child.badgeVariant}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MobileNav({ pathname }: { readonly pathname: string }) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Ouvrir le menu de navigation"
          />
        }
      >
        <Menu className="size-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[320px] max-w-[85vw] flex-col p-0"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="text-base">Navigation</SheetTitle>
        </SheetHeader>
        <nav
          className="flex-1 overflow-y-auto px-3 py-4"
          aria-label="Navigation mobile"
        >
          <div className="space-y-6">
            {NAV_SECTIONS.map((section, index) => (
              <div key={section.label ?? `public-${index}`} className="space-y-1">
                {section.label && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </p>
                )}
                {section.items.map((item) => (
                  <NavItemMobile
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    onNavigate={close}
                  />
                ))}
              </div>
            ))}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Composant                                                          */
/* ------------------------------------------------------------------ */

export function Nav({ className }: NavProps) {
  const pathname = usePathname();

  return (
    <div className={cn("flex items-center", className)}>
      <NavigationMenu
        className="hidden md:flex"
        aria-label="Navigation principale"
      >
        {/*
          NavigationMenuList rend un <ul>. Ses enfants DIRECTS doivent
          donc être des <li>. NavItemDesktop retourne déjà un <li>
          (via NavigationMenuItem), et le séparateur est wrappé dans
          un <li aria-hidden>. On n'enveloppe JAMAIS un NavItemDesktop
          dans un autre NavigationMenuItem (sinon <li> > <li>).
        */}
        <NavigationMenuList>
          {NAV_SECTIONS.map((section, index) => (
            <Fragment key={section.label ?? `section-${index}`}>
              {index > 0 && (
                <li
                  aria-hidden
                  className="mx-1 flex items-center self-stretch"
                >
                  <Separator orientation="vertical" className="h-6" />
                </li>
              )}
              {section.items.map((item) => (
                <NavItemDesktop
                  key={item.href}
                  item={item}
                  pathname={pathname}
                />
              ))}
            </Fragment>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <MobileNav pathname={pathname} />
    </div>
  );
}
