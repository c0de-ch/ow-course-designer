"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { BrandMark } from "@/components/ui/BrandMark";

/** Top bar for the signed-in pages (dashboard, settings). */
export function AppHeader() {
  const { data: session } = useSession();
  const userLabel = session?.user?.name ?? session?.user?.email;

  return (
    <header className="bg-base-100 border-b border-base-300">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 h-16">
        <BrandMark href="/dashboard" />
        <div className="flex items-center gap-3">
          {userLabel && (
            <span className="hidden sm:flex items-center gap-2 text-sm text-base-content/70">
              <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold uppercase">
                {userLabel.charAt(0)}
              </span>
              {userLabel}
            </span>
          )}
          <Link href="/settings" className="btn btn-ghost btn-sm">
            Settings
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
