import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginButton } from "@/components/auth/LoginButton";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/chat");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">💬</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            社内 AI チャット
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            @churadata.okinawa アカウントでログインしてください
          </p>
        </div>

        <div className="flex justify-center">
          <LoginButton />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-600">
          このサービスは churadata.okinawa の社内スタッフ専用です
        </p>
      </div>
    </main>
  );
}
