"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <Button
      aria-label="Keluar dari Glutong POS"
      disabled={pending}
      onClick={handleSignOut}
      size="icon"
      variant="outline"
    >
      {pending ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
    </Button>
  );
}
