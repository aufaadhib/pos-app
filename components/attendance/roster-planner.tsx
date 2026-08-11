"use client";

import { useMemo, useState, useTransition } from "react";
import { ClipboardCopy, Pencil, Plus, Save, Send } from "lucide-react";
import { toast } from "react-toastify";
import { copyRosterWeekAction, createShiftTemplateAction, publishRosterWeekAction, saveRosterDraftAction, updatePublishedRosterEntryAction } from "@/app/attendance/roster/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { addIsoDays } from "@/lib/attendance/roster";

type Staff = { id: string; name: string; email: string; role: string | null; jobPosition: { id: string; name: string } | null };
type Template = { id: string; name: string; startTime: string; endTime: string; updatedAt: string };
type Entry = { id: string; userId: string; workDate: string; shiftTemplateId: string; shiftName: string; scheduledStartAt: string; scheduledEndAt: string; updatedAt: string };
type Week = { id: string; status: "DRAFT" | "PUBLISHED"; publishedAt: string | null; updatedAt: string; entries: Entry[] } | null;

/** Edits a weekly draft as a desktop board or day cards and publishes immutable schedule snapshots. */
export function RosterPlanner({ outlet, staff, templates, week, weekStart }: { outlet: { id: string; code: string; name: string; timezone: string }; staff: Staff[]; templates: Template[]; week: Week; weekStart: string }) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index)), [weekStart]);
  const initialCells = useMemo(() => Object.fromEntries((week?.entries ?? []).map((entry) => [`${entry.userId}:${entry.workDate}`, entry.shiftTemplateId])), [week]);
  const [cells, setCells] = useState<Record<string, string>>(initialCells);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editTemplateId, setEditTemplateId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const published = week?.status === "PUBLISHED";
  const templateOptions = templates.map((template) => ({ value: template.id, label: `${template.name} · ${template.startTime}–${template.endTime}` }));

  function execute(action: () => Promise<{ status: "success" | "error"; message: string }>) { startTransition(async () => { const result = await action(); toast[result.status === "success" ? "success" : "error"](result.message); }); }
  function saveDraft() { const entries = Object.entries(cells).filter(([, value]) => value).map(([key, shiftTemplateId]) => { const separator = key.lastIndexOf(":"); return { userId: key.slice(0, separator), workDate: key.slice(separator + 1), shiftTemplateId }; }); execute(() => saveRosterDraftAction({ outletId: outlet.id, weekStart, expectedUpdatedAt: week?.updatedAt ?? null, entries })); }
  function publish() { if (!week) return; execute(() => publishRosterWeekAction({ outletId: outlet.id, weekStart, expectedUpdatedAt: week.updatedAt })); }
  function copyPrevious() { execute(() => copyRosterWeekAction({ outletId: outlet.id, sourceWeekStart: addIsoDays(weekStart, -7), targetWeekStart: weekStart })); }
  function createTemplate() { execute(async () => { const result = await createShiftTemplateAction({ outletId: outlet.id, name: templateName, startTime, endTime }); if (result.status === "success") setTemplateOpen(false); return result; }); }
  function beginEdit(entry: Entry) { setEditingEntry(entry); setEditTemplateId(entry.shiftTemplateId); setReason(""); }
  function updateEntry() { if (!editingEntry) return; execute(async () => { const result = await updatePublishedRosterEntryAction({ entryId: editingEntry.id, shiftTemplateId: editTemplateId, expectedUpdatedAt: editingEntry.updatedAt, reason }); if (result.status === "success") setEditingEntry(null); return result; }); }

  const picker = (userId: string, workDate: string) => {
    const key = `${userId}:${workDate}`;
    const entry = week?.entries.find((item) => item.userId === userId && item.workDate === workDate);
    if (published) return entry ? <div className="grid gap-1 rounded-lg border border-primary/20 bg-primary/5 p-2"><span className="text-xs font-semibold">{entry.shiftName}</span><span className="font-mono text-[.65rem] text-muted-foreground">{time(entry.scheduledStartAt, outlet.timezone)}–{time(entry.scheduledEndAt, outlet.timezone)}</span>{new Date(entry.scheduledStartAt) > new Date() && <button className="mt-1 flex min-h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/10" onClick={() => beginEdit(entry)} type="button"><Pencil className="size-3" />Ubah</button>}</div> : <span className="block rounded-lg border border-dashed p-2 text-center text-xs text-muted-foreground">Libur</span>;
    return <select aria-label={`Shift ${workDate}`} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/40" onChange={(event) => setCells((current) => ({ ...current, [key]: event.target.value }))} value={cells[key] ?? ""}><option value="">Libur</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.startTime}</option>)}</select>;
  };

  return <div className="grid gap-6">
    <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-semibold">Papan mingguan</h2><Badge variant={published ? "default" : "secondary"}>{published ? "Terbit" : "Draf"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Satu staf hanya dapat memiliki satu shift pada setiap tanggal.</p></div><div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={pending || Boolean(week)} onClick={copyPrevious} variant="outline"><ClipboardCopy aria-hidden="true" />Salin minggu lalu</Button><Button className="min-h-11" onClick={() => setTemplateOpen(true)} variant="outline"><Plus aria-hidden="true" />Template shift</Button>{!published && <Button className="min-h-11" disabled={pending} onClick={saveDraft}>{pending ? <Spinner /> : <Save aria-hidden="true" />}Simpan draf</Button>}{week && !published && <Button className="min-h-11" disabled={pending || !week.entries.length} onClick={publish}>{pending ? <Spinner /> : <Send aria-hidden="true" />}Terbitkan</Button>}</div></div>
      {!staff.length && <p className="mt-5 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada staf aktif dengan jabatan pada outlet ini.</p>}
      <div className="mt-5 hidden xl:grid xl:grid-cols-[minmax(12rem,1.4fr)_repeat(7,minmax(7.5rem,1fr))] xl:overflow-hidden xl:rounded-xl xl:border"><div className="bg-muted/45 p-3 text-xs font-semibold">Staf</div>{dates.map((date) => <div className="border-l bg-muted/45 p-3 text-center" key={date}><span className="block text-xs font-semibold">{weekday(date)}</span><span className="font-mono text-[.65rem] text-muted-foreground">{shortDate(date)}</span></div>)}{staff.flatMap((person) => [<div className="border-t p-3" key={`${person.id}:name`}><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>, ...dates.map((date) => <div className="min-w-0 border-t border-l p-2" key={`${person.id}:${date}`}>{picker(person.id, date)}</div>)])}</div>
      <div className="mt-5 grid gap-4 xl:hidden">{dates.map((date) => <section className="overflow-hidden rounded-xl border" key={date}><header className="flex items-center justify-between bg-muted/45 px-4 py-3"><h3 className="font-semibold">{weekday(date)}</h3><span className="font-mono text-xs text-muted-foreground">{shortDate(date)}</span></header><div className="divide-y">{staff.map((person) => <div className="grid gap-2 p-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.2fr)] sm:items-center" key={person.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>{picker(person.id, date)}</div>)}</div></section>)}</div>
    </section>
    <Dialog onOpenChange={setTemplateOpen} open={templateOpen}><DialogContent><DialogHeader><DialogTitle>Template shift baru</DialogTitle><DialogDescription>Jika jam selesai tidak lebih besar dari jam mulai, shift dianggap berakhir pada hari berikutnya.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="shift-name">Nama shift</Label><Input id="shift-name" maxLength={60} onChange={(event) => setTemplateName(event.target.value)} placeholder="Contoh: Pagi" value={templateName} /></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="shift-start">Mulai</Label><Input id="shift-start" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} /></div><div className="grid gap-2"><Label htmlFor="shift-end">Selesai</Label><Input id="shift-end" onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} /></div></div></div><DialogFooter><Button onClick={() => setTemplateOpen(false)} variant="outline">Batal</Button><Button disabled={pending || templateName.trim().length < 2} onClick={createTemplate}>{pending && <Spinner />}Buat template</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => { if (!open) setEditingEntry(null); }} open={editingEntry !== null}><DialogContent><DialogHeader><DialogTitle>Ubah jadwal terbit</DialogTitle><DialogDescription>Hanya jadwal yang belum mulai dapat diubah. Alasan masuk ke audit trail.</DialogDescription></DialogHeader><div className="grid gap-4"><SearchableSelect aria-label="Template shift pengganti" onValueChange={setEditTemplateId} options={templateOptions} value={editTemplateId} /><Textarea aria-label="Alasan perubahan roster" maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="Alasan perubahan minimal 8 karakter" value={reason} /></div><DialogFooter><Button onClick={() => setEditingEntry(null)} variant="outline">Batal</Button><Button disabled={pending || reason.trim().length < 8 || !editTemplateId} onClick={updateEntry}>{pending && <Spinner />}Simpan perubahan</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function weekday(value: string) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function shortDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function time(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value)); }
