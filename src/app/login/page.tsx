import { redirect } from "next/navigation";
import { AuthView } from "@/components/auth-view";
import { getCurrentUser } from "@/lib/auth";
import { ALLOW_REGISTRATION } from "@/lib/config";
import { countUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { mode?: string; next?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await getCurrentUser();
  if (user) redirect("/drive");
  const params = await searchParams;
  const canRegister = ALLOW_REGISTRATION || countUsers() === 0;
  const requested = params.mode === "register" ? "register" : "login";
  const mode = canRegister ? requested : "login";
  const next = params.next && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/drive";
  return (
    <AuthView
      initialMode={mode}
      allowRegistration={canRegister}
      next={next}
      memberCount={countUsers()}
    />
  );
}
