/*
path :           components/header/Nav.tsx
tag :            ["header", "nav", "navigation", "ui"]
projectId:       <recipe-miam>
type:            component
generic:         false

role:            Navigation principale du header. Affiche les items
                 NAV_ITEMS en navigation desktop (Base UI NavigationMenu
                 avec dropdown pour les items ayant des children) et en
                 Sheet mobile (drawer avec sections repliables). Utilise
                 usePathname pour l'état actif. Aucune logique métier :
                 purement présentationnel et interactif.

flow:            Reçoit className optionnel → usePathname → rend
                 NavigationMenu (desktop, hidden md:flex) et Sheet
                 (mobile, md:hidden). Chaque item sans children est un
                 lien direct ; chaque item avec children a un trigger
                 qui ouvre un dropdown en grille 2 colonnes (desktop)
                 ou une liste repliable (mobile). Lien actif surligné
                 via aria-current et classes.

ecosystem:       Header = [
                   "@/components/header/dataNav.ts",
                   "@/components/header/Header.tsx",
                   "@/components/header/Nav.tsx",
                 ]

relatedFiles:    ["@/components/header/dataNav.ts",
                  "@/components/header/Header.tsx"]

imports:         ["next/link",
                  "next/navigation",
                  "react",
                  "lucide-react",
                  "@/lib/utils",
                  "@/components/header/dataNav",
                  "@/components/ui/navigation-menu",
                  "@/components/ui/sheet",
                  "@/components/ui/button",
                  "@/components/ui/collapsible"]

exports:         ["Nav", "NavProps"]

useBy:           ["@/components/header/Header.tsx"]

userStories:     ["*en tant qu'utilisateur je veux une navigation responsive et hiérarchisée"]

status:          planned
pathChecked:     ✘false
metaDataChecked: ✘false
scriptChecked:   ✘false
*/

"use client";
// "use client" justifié : usePathname, useState (mobile), interactions.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  type NavChild,
  type NavItem,
} from "@/components/header/dataNav";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

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
  return pathname === child.href;
}

/* ------------------------------------------------------------------ */
/*  Desktop — NavigationMenu                                           */
/* ------------------------------------------------------------------ */

function NavItemDesktop({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  const hasChildren = item.children && item.children.length > 0;

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
        <ul className="grid w-[380px] gap-1 p-2 sm:w-[440px] sm:grid-cols-2">
          {item.children?.map((child) => {
            const ChildIcon = child.icon;
            const childActive = isChildActive(child, pathname);
            return (
              <li key={child.href}>
                <NavigationMenuLink
                  render={<Link href={child.href} />}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3 transition-colors outline-none",
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
                    <span className="block text-sm font-medium text-foreground">
                      {child.label}
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
  item: NavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const active = isItemActive(item, pathname);
  const hasChildren = item.children && item.children.length > 0;
  const [expanded, setExpanded] = useState(active && hasChildren);

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
            aria-label={expanded ? `Replier ${item.label}` : `Déplier ${item.label}`}
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
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
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
      <SheetContent side="left" className="w-[320px] max-w-[85vw] p-0">
        <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
          <SheetTitle className="text-base">Navigation</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation mobile">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavItemMobile
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={close}
              />
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
      <NavigationMenu className="hidden md:flex" aria-label="Navigation principale">
        <NavigationMenuList>
          {NAV_ITEMS.map((item) => (
            <NavItemDesktop key={item.href} item={item} pathname={pathname} />
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <MobileNav pathname={pathname} />
    </div>
  );
}