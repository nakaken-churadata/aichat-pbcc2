import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/common/Header";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
