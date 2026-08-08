"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error("Sesi belum dapat diakhiri. Coba lagi.");
        return;
      }
      window.location.replace("/sign-in");
    } catch {
      toast.error("Glutong POS belum dapat dihubungi. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      aria-label={pending ? "Sedang keluar dari Glutong POS" : "Keluar dari Glutong POS"}
      className="aspect-square min-w-12 shadow-sm"
      disabled={pending}
      onClick={handleSignOut}
      size="icon"
      title="Keluar"
      variant="destructive"
    >
      {pending ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
    </Button>
  );
}
