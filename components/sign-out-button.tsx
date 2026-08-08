"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({ hasOpenShift = false }: { hasOpenShift?: boolean }) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  /** Ends the Better Auth session without implicitly mutating an open cash shift. */
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

  const button = (
    <Button
      aria-label={pending ? "Sedang keluar dari Glutong POS" : "Keluar dari Glutong POS"}
      className="aspect-square min-w-12 shadow-sm"
      disabled={pending}
      onClick={hasOpenShift ? undefined : handleSignOut}
      size="icon"
      title="Keluar"
      variant="destructive"
    >
      {pending ? <Spinner aria-hidden="true" /> : <LogOut aria-hidden="true" />}
    </Button>
  );
  if (!hasOpenShift) return button;
  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger render={button} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluar dengan shift terbuka?</AlertDialogTitle>
          <AlertDialogDescription>
            Shift tidak ikut ditutup. Anda dapat melanjutkannya setelah masuk kembali, atau tutup shift terlebih dahulu dari menu Shift.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Kembali</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleSignOut} variant="destructive">
            {pending && <Spinner aria-hidden="true" />}
            {pending ? "Keluar…" : "Tetap keluar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
