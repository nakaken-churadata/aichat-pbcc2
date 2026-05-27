"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          社内 AI チャット
        </h1>

        {session?.user && (
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "ユーザー"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="hidden text-sm text-gray-700 dark:text-gray-300 sm:block">
              {session.user.email}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
