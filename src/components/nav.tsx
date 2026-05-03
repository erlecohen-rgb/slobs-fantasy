"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";

const links = [
  { href: "/dashboard", label: "My Team" },
  { href: "/scores", label: "Scores" },
  { href: "/standings", label: "Standings" },
  { href: "/roster", label: "Roster" },
  { href: "/report", label: "Report" },
  { href: "/admin", label: "Admin" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop top nav */}
      <nav className="bg-green-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold tracking-tight">
                SLOBS
              </Link>
              <div className="hidden md:flex gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      pathname.startsWith(link.href)
                        ? "bg-green-900 text-white"
                        : "text-green-100 hover:bg-green-700"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <UserButton />
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-green-800 border-t border-green-700 z-50 safe-area-bottom">
        <div className="flex justify-around">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 text-center py-3 text-xs font-medium transition-colors ${
                pathname.startsWith(link.href)
                  ? "bg-green-900 text-white"
                  : "text-green-200 active:bg-green-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
