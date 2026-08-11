"use client";

import { useState, useTransition } from "react";
import { Archive, Pencil, Plus, RotateCcw, UsersRound } from "lucide-react";
import { toast } from "react-toastify";
import { archiveStaffPositionAction, createStaffPositionAction, restoreStaffPositionAction, updateStaffPositionAction } from "@/app/settings/staff-position-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type Position = { id: string; name: string; status: "ACTIVE" | "ARCHIVED"; staffCount: number; updatedAt: string };

/** Provides owner-only position CRUD while preserving archived historical references. */
export function StaffPositionManager({ positions }: { positions: Position[] }) {
  const [editing, setEditing] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(position?: Position) { setEditing(position ?? null); setName(position?.name ?? ""); setOpen(true); }
  function save() { startTransition(async () => { const result = editing ? await updateStaffPositionAction({ id: editing.id, expectedUpdatedAt: editing.updatedAt, name }) : await createStaffPositionAction({ name }); toast[result.status === "success" ? "success" : "error"](result.message); if (result.status === "success") setOpen(false); }); }
  function changeStatus(position: Position) { startTransition(async () => { const action = position.status === "ACTIVE" ? archiveStaffPositionAction : restoreStaffPositionAction; const result = await action({ id: position.id, expectedUpdatedAt: position.updatedAt }); toast[result.status === "success" ? "success" : "error"](result.message); }); }

  return <div className="grid gap-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-heading text-xl font-semibold">Daftar jabatan</h2><p className="mt-1 text-sm text-muted-foreground">Jabatan menjelaskan pekerjaan tanpa memberikan permission aplikasi.</p></div><Button className="min-h-11" onClick={() => begin()}><Plus aria-hidden="true" />Jabatan baru</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{positions.map((position) => <article className="grid gap-4 rounded-xl border bg-card p-4" key={position.id}><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UsersRound aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{position.name}</h3><p className="mt-1 text-xs text-muted-foreground">{position.staffCount} akun menggunakan jabatan ini</p></div><Badge variant={position.status === "ACTIVE" ? "secondary" : "outline"}>{position.status === "ACTIVE" ? "Aktif" : "Arsip"}</Badge></div><div className="grid grid-cols-2 gap-2"><Button className="min-h-11" disabled={pending} onClick={() => begin(position)} variant="outline"><Pencil aria-hidden="true" />Ubah</Button><Button className="min-h-11" disabled={pending} onClick={() => changeStatus(position)} variant={position.status === "ACTIVE" ? "destructive" : "outline"}>{pending ? <Spinner /> : position.status === "ACTIVE" ? <Archive aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}{position.status === "ACTIVE" ? "Arsipkan" : "Pulihkan"}</Button></div></article>)}</div>
    {!positions.length && <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Belum ada jabatan. Buat jabatan sebelum menambahkan staf.</p>}
    <Dialog onOpenChange={setOpen} open={open}><DialogContent><DialogHeader><DialogTitle>{editing ? "Ubah jabatan" : "Jabatan baru"}</DialogTitle><DialogDescription>Nama jabatan tampil pada staf, roster, dan laporan absensi.</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="position-name">Nama jabatan</Label><Input autoFocus id="position-name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Pelayan" value={name} /></div><DialogFooter><Button disabled={pending} onClick={() => setOpen(false)} variant="outline">Batal</Button><Button disabled={pending || name.trim().length < 2} onClick={save}>{pending && <Spinner />}{editing ? "Simpan perubahan" : "Buat jabatan"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
