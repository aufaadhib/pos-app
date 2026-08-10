"use client";

import { useState, useTransition } from "react";
import { Download, Eye, FilePenLine, ScanFace, ShieldCheck, ShieldX, UserRoundX } from "lucide-react";
import { toast } from "react-toastify";

import { correctAttendanceSessionAction, reviewAttendanceExceptionAction, revokeFaceProfileAction } from "@/app/attendance/manage/actions";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

type PendingRequest = { id: string; reason: string; requestedAt: string; userId: string; user: { id: string; name: string; email: string }; verification: { kind: "CHECK_IN" | "CHECK_OUT" }; attempt: { id: string; attemptedAt: string; failureReason: string | null; evidenceAvailable: boolean } };
type AttendanceEvidence = { attemptId: string; available: boolean } | null;
type ManagedSession = { id: string; userId: string; user?: { id?: string; name: string; email: string }; status: "OPEN" | "CLOSED"; checkInAt: string; checkOutAt: string | null; originalCheckInAt: string; originalCheckOutAt: string | null; outlet: { code: string; name: string; timezone: string }; checkInEvidence: AttendanceEvidence; checkOutEvidence: AttendanceEvidence; correction: { reason: string; actorName: string; createdAt: string } | null };
type StaffProfile = { id: string; name: string; email: string; banned: boolean | null; profile: { id: string; enrolledAt: string } | null };

/** Provides exception review, append-only correction, biometric revocation, and report export. */
export function AttendanceManagement({ outletId, currentUserId, pendingRequests, sessions, staffProfiles, timezone }: { outletId: string; currentUserId: string; pendingRequests: PendingRequest[]; sessions: ManagedSession[]; staffProfiles: StaffProfile[]; timezone: string }) {
  const [review, setReview] = useState<PendingRequest | null>(null);
  const [correction, setCorrection] = useState<ManagedSession | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<StaffProfile | null>(null);
  const [reason, setReason] = useState("");
  const [checkInAt, setCheckInAt] = useState("");
  const [checkOutAt, setCheckOutAt] = useState("");
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  function openCorrection(session: ManagedSession) {
    setCorrection(session);
    setReason("");
    setCheckInAt(toLocalInput(session.checkInAt));
    setCheckOutAt(session.checkOutAt ? toLocalInput(session.checkOutAt) : "");
  }

  function submitReview(decision: "APPROVED" | "REJECTED") {
    if (!review) return;
    startTransition(async () => {
      const result = await reviewAttendanceExceptionAction({ requestId: review.id, decision, reason });
      if (result.status === "success") toast.success(decision === "APPROVED" ? "Pengecualian disetujui." : "Pengecualian ditolak.");
      else toast.error(result.message);
      if (result.status === "success") { setReview(null); setReason(""); }
    });
  }

  function submitCorrection() {
    if (!correction) return;
    startTransition(async () => {
      const result = await correctAttendanceSessionAction({ sessionId: correction.id, correctedCheckInAt: checkInAt ? new Date(checkInAt).toISOString() : null, correctedCheckOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : null, reason });
      if (result.status === "success") toast.success("Koreksi waktu ditambahkan.");
      else toast.error(result.message);
      if (result.status === "success") { setCorrection(null); setReason(""); }
    });
  }

  function revoke() {
    if (!revokeTarget) return;
    startTransition(async () => {
      const result = await revokeFaceProfileAction(revokeTarget.id);
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
      if (result.status === "success") setRevokeTarget(null);
    });
  }

  return <div className="grid gap-6">
    <section aria-labelledby="exception-heading"><div className="flex items-end justify-between gap-4"><div><h2 className="font-heading text-xl font-semibold" id="exception-heading">Pengecualian menunggu</h2><p className="mt-1 text-sm text-muted-foreground">Muncul setelah tiga kegagalan dalam 15 menit.</p></div><Badge variant={pendingRequests.length ? "destructive" : "secondary"}>{pendingRequests.length} pending</Badge></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{pendingRequests.length ? pendingRequests.map((request) => <article className="rounded-xl border bg-card p-4" key={request.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{request.user.name}</h3><p className="text-sm text-muted-foreground">{request.user.email}</p></div><Badge variant="outline">{request.verification.kind === "CHECK_IN" ? "Masuk" : "Pulang"}</Badge></div><p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm leading-6">{request.reason}</p><p className="mt-3 text-xs text-muted-foreground">Percobaan {formatDateTime(request.attempt.attemptedAt, timezone)} · {request.attempt.failureReason ?? "Gagal"}</p><div className="mt-4 flex flex-wrap gap-2"><AttendanceEvidenceButton evidence={{ attemptId: request.attempt.id, available: request.attempt.evidenceAvailable }} label="Lihat bukti" /><Button className="min-h-11" disabled={request.userId === currentUserId} onClick={() => { setReview(request); setReason(""); }} type="button"><ShieldCheck aria-hidden="true" />Tinjau</Button></div>{request.userId === currentUserId && <p className="mt-2 text-xs text-destructive">Permintaan sendiri harus ditinjau manager lain atau pemilik.</p>}</article>) : <div className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground lg:col-span-2">Tidak ada permintaan pengecualian yang menunggu.</div>}</div>
    </section>

    <section aria-labelledby="records-heading"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="font-heading text-xl font-semibold" id="records-heading">Catatan kehadiran</h2><p className="mt-1 text-sm text-muted-foreground">Koreksi disimpan sebagai catatan baru tanpa mengubah waktu asli.</p></div><div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 sm:max-w-xl md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:w-auto"><label className="grid min-w-0 gap-1 text-xs" htmlFor="attendance-export-from">Dari<Input className="h-10 min-w-0 w-full" id="attendance-export-from" onChange={(event) => setFrom(event.target.value)} type="date" value={from} /></label><label className="grid min-w-0 gap-1 text-xs" htmlFor="attendance-export-to">Sampai<Input className="h-10 min-w-0 w-full" id="attendance-export-to" onChange={(event) => setTo(event.target.value)} type="date" value={to} /></label><Button className="col-span-2 min-h-11 w-full md:col-span-1 md:w-auto" nativeButton={false} render={<a href={`/api/reports/attendance/export?outletId=${encodeURIComponent(outletId)}&from=${from}&to=${to}`} />} variant="outline"><Download aria-hidden="true" />CSV</Button></div></div>
      <div className="mt-4 hidden overflow-hidden rounded-xl border bg-card lg:block"><Table><TableHeader><TableRow><TableHead>Staf</TableHead><TableHead>Masuk</TableHead><TableHead>Pulang</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{sessions.map((session) => <TableRow key={session.id}><TableCell><span className="font-semibold">{session.user?.name}</span><span className="block text-xs text-muted-foreground">{session.user?.email}</span></TableCell><TableCell>{formatDateTime(session.checkInAt, session.outlet.timezone)}</TableCell><TableCell>{session.checkOutAt ? formatDateTime(session.checkOutAt, session.outlet.timezone) : "—"}</TableCell><TableCell><Badge variant="outline">{session.status === "OPEN" ? "Terbuka" : session.correction ? "Dikoreksi" : "Selesai"}</Badge></TableCell><TableCell><div className="flex flex-wrap justify-end gap-2"><AttendanceEvidenceButton evidence={session.checkInEvidence} label="Foto masuk" /><AttendanceEvidenceButton evidence={session.checkOutEvidence} label="Foto pulang" /><Button className="min-h-11" onClick={() => openCorrection(session)} size="sm" type="button" variant="outline"><FilePenLine aria-hidden="true" />Koreksi</Button></div></TableCell></TableRow>)}</TableBody></Table></div>
      <div className="mt-4 grid gap-3 lg:hidden">{sessions.map((session) => <article className="rounded-xl border bg-card p-4" key={session.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{session.user?.name}</h3><p className="text-xs text-muted-foreground">{session.user?.email}</p></div><Badge variant="outline">{session.status === "OPEN" ? "Terbuka" : "Selesai"}</Badge></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">Masuk</dt><dd className="mt-1">{formatDateTime(session.checkInAt, session.outlet.timezone)}</dd></div><div><dt className="text-xs text-muted-foreground">Pulang</dt><dd className="mt-1">{session.checkOutAt ? formatDateTime(session.checkOutAt, session.outlet.timezone) : "—"}</dd></div></dl><div className="mt-4 grid grid-cols-2 gap-2"><AttendanceEvidenceButton evidence={session.checkInEvidence} label="Foto masuk" /><AttendanceEvidenceButton evidence={session.checkOutEvidence} label="Foto pulang" /><Button className="col-span-2 min-h-11 w-full" onClick={() => openCorrection(session)} type="button" variant="outline"><FilePenLine aria-hidden="true" />Koreksi waktu</Button></div></article>)}</div>
      {!sessions.length && <p className="mt-4 rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">Belum ada catatan kehadiran pada outlet ini.</p>}
    </section>

    <section aria-labelledby="profiles-heading"><div><h2 className="font-heading text-xl font-semibold" id="profiles-heading">Profil wajah staf</h2><p className="mt-1 text-sm text-muted-foreground">Pembatalan menghapus template aktif dan mewajibkan pendaftaran ulang.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{staffProfiles.map((staff) => <article className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4" key={staff.id}><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ScanFace aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{staff.name}</h3><p className="truncate text-xs text-muted-foreground">{staff.profile ? `Aktif sejak ${formatDate(staff.profile.enrolledAt)}` : "Belum terdaftar"}</p></div>{staff.profile && <Button aria-label={`Batalkan profil wajah ${staff.name}`} disabled={pending} onClick={() => setRevokeTarget(staff)} size="icon" title="Batalkan profil wajah" variant="destructive"><UserRoundX aria-hidden="true" /></Button>}</article>)}</div></section>

    <Dialog onOpenChange={(open) => { if (!open) setReview(null); }} open={review !== null}><DialogContent><DialogHeader><DialogTitle>Tinjau pengecualian</DialogTitle><DialogDescription>Keputusan akan memakai waktu percobaan asli dan masuk ke audit trail.</DialogDescription></DialogHeader><Textarea aria-label="Catatan keputusan" maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="Jelaskan dasar keputusan minimal 8 karakter" rows={3} value={reason} /><DialogFooter><Button disabled={pending || reason.trim().length < 8} onClick={() => submitReview("REJECTED")} type="button" variant="destructive">{pending ? <Spinner /> : <ShieldX aria-hidden="true" />}Tolak</Button><Button disabled={pending || reason.trim().length < 8} onClick={() => submitReview("APPROVED")} type="button">{pending ? <Spinner /> : <ShieldCheck aria-hidden="true" />}Setujui</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => { if (!open) setCorrection(null); }} open={correction !== null}><DialogContent><DialogHeader><DialogTitle>Koreksi waktu absensi</DialogTitle><DialogDescription>Waktu asli tetap tersimpan. Isi nilai efektif dan alasan perubahan.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="correct-check-in">Waktu masuk</Label><Input id="correct-check-in" onChange={(event) => setCheckInAt(event.target.value)} type="datetime-local" value={checkInAt} /></div><div className="grid gap-2"><Label htmlFor="correct-check-out">Waktu pulang</Label><Input id="correct-check-out" onChange={(event) => setCheckOutAt(event.target.value)} type="datetime-local" value={checkOutAt} /></div></div><Textarea aria-label="Alasan koreksi" maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="Alasan koreksi minimal 8 karakter" rows={3} value={reason} /><DialogFooter><Button disabled={pending} onClick={() => setCorrection(null)} type="button" variant="outline">Batal</Button><Button disabled={pending || reason.trim().length < 8} onClick={submitCorrection} type="button">{pending ? <Spinner /> : <FilePenLine aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan koreksi"}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog onOpenChange={(open) => { if (!open) setRevokeTarget(null); }} open={revokeTarget !== null}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Batalkan profil wajah?</AlertDialogTitle><AlertDialogDescription>Template wajah aktif {revokeTarget?.name} akan dihapus. Staf harus mendaftarkan tiga sampel baru sebelum dapat melakukan absensi.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={pending}>Kembali</AlertDialogCancel><AlertDialogAction disabled={pending} onClick={revoke} variant="destructive">{pending ? <Spinner /> : <UserRoundX aria-hidden="true" />}{pending ? "Membatalkan…" : "Batalkan profil"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

/** Opens an authorized private attendance photo or explains that retention has ended. */
function AttendanceEvidenceButton({ evidence, label }: { evidence: AttendanceEvidence; label: string }) {
  if (!evidence?.available) return <Button className="min-h-11" disabled size="sm" title="Foto tidak tersedia atau masa simpan sudah berakhir." variant="outline"><Eye aria-hidden="true" />{label}</Button>;
  return <Button className="min-h-11" nativeButton={false} render={<a href={`/api/attendance/evidence/${evidence.attemptId}`} rel="noreferrer" target="_blank" />} size="sm" variant="outline"><Eye aria-hidden="true" />{label}</Button>;
}
