"use client";

import { useMemo, useState, useTransition } from "react";
import { Archive, CalendarCheck2, CalendarPlus, ClipboardCopy, Clock3, Copy, Pencil, Plus, Repeat2, Save, Send } from "lucide-react";
import { toast } from "react-toastify";
import { addPublishedRosterEntryAction, archiveShiftTemplateAction, copyRosterWeekAction, createShiftTemplateAction, publishRosterWeekAction, resetFixedScheduleOverrideAction, saveFixedSchedulesAction, saveRosterDraftAction, updatePublishedRosterEntryAction, updateScheduleModeAction, updateShiftTemplateAction } from "@/app/attendance/roster/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
type Week = { id: string; status: "DRAFT" | "PUBLISHED"; source: "MANUAL" | "FIXED"; publishedAt: string | null; updatedAt: string; entries: Entry[] } | null;
type Revision = { entry: Entry | null; userId: string; workDate: string };
type ActionResult = { status: "success" | "error"; message: string };
const DAY_OFF = "__day_off__";
const FOLLOW_PATTERN = "__follow_pattern__";
const weekDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/** Manages shift templates and weekly draft or published roster cells across responsive layouts. */
export function RosterPlanner({ outlet, staff, templates, week, weekStart, fixedSchedules, overrides }: { outlet: { id: string; code: string; name: string; timezone: string; attendanceScheduleMode: "WEEKLY" | "FIXED"; attendanceScheduleEffectiveFrom: string | null; updatedAt: string }; staff: Staff[]; templates: Template[]; week: Week; weekStart: string; fixedSchedules: Array<{ userId: string; weekday: number; shiftTemplateId: string }>; overrides: Array<{ userId: string; workDate: string }> }) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index)), [weekStart]);
  const initialCells = useMemo(() => Object.fromEntries((week?.entries ?? []).map((entry) => [`${entry.userId}:${entry.workDate}`, entry.shiftTemplateId])), [week]);
  const [cells, setCells] = useState<Record<string, string>>(initialCells);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [archivingTemplate, setArchivingTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [revision, setRevision] = useState<Revision | null>(null);
  const [revisionTemplateId, setRevisionTemplateId] = useState("");
  const [reason, setReason] = useState("");
  const [fixedCells, setFixedCells] = useState<Record<string, string>>(() => Object.fromEntries(fixedSchedules.map((entry) => [`${entry.userId}:${entry.weekday}`, entry.shiftTemplateId])));
  const [copyOpen, setCopyOpen] = useState(false);
  const [copySource, setCopySource] = useState(staff[0]?.id ?? "");
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [showFixedEditor, setShowFixedEditor] = useState(outlet.attendanceScheduleMode === "FIXED");
  const [pending, startTransition] = useTransition();
  const published = week?.status === "PUBLISHED";
  const templateOptions = [...(week?.source === "FIXED" ? [{ value: FOLLOW_PATTERN, label: "Ikuti pola tetap" }] : []), { value: DAY_OFF, label: "Libur · hapus shift" }, ...templates.map((template) => ({ value: template.id, label: `${template.name} · ${template.startTime}–${template.endTime}` }))];

  function execute(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      toast[result.status === "success" ? "success" : "error"](result.message);
      if (result.status === "success") onSuccess?.();
    });
  }

  function saveDraft() {
    const entries = Object.entries(cells).filter(([, value]) => value).map(([key, shiftTemplateId]) => { const separator = key.lastIndexOf(":"); return { userId: key.slice(0, separator), workDate: key.slice(separator + 1), shiftTemplateId }; });
    execute(() => saveRosterDraftAction({ outletId: outlet.id, weekStart, expectedUpdatedAt: week?.updatedAt ?? null, entries }));
  }

  function saveFixed() {
    const entries = Object.entries(fixedCells).filter(([, value]) => value).map(([key, shiftTemplateId]) => { const separator = key.lastIndexOf(":"); return { userId: key.slice(0, separator), weekday: Number(key.slice(separator + 1)), shiftTemplateId }; });
    execute(() => saveFixedSchedulesAction({ outletId: outlet.id, expectedUpdatedAt: outlet.updatedAt, entries }));
  }

  function switchMode(mode: "WEEKLY" | "FIXED") {
    execute(() => updateScheduleModeAction({ outletId: outlet.id, expectedUpdatedAt: outlet.updatedAt, mode }));
  }

  function copyPattern() {
    if (!copySource || !copyTargets.length) return;
    setFixedCells((current) => {
      const next = { ...current };
      for (const target of copyTargets) for (let day = 1; day <= 7; day += 1) {
        const source = current[`${copySource}:${day}`] ?? "";
        if (source) next[`${target}:${day}`] = source;
        else delete next[`${target}:${day}`];
      }
      return next;
    });
    setCopyOpen(false);
    setCopyTargets([]);
  }

  function beginTemplate(template?: Template) {
    setEditingTemplate(template ?? null);
    setTemplateName(template?.name ?? "");
    setStartTime(template?.startTime ?? "08:00");
    setEndTime(template?.endTime ?? "16:00");
    setTemplateOpen(true);
  }

  function saveTemplate() {
    const action = editingTemplate
      ? () => updateShiftTemplateAction({ id: editingTemplate.id, outletId: outlet.id, expectedUpdatedAt: editingTemplate.updatedAt, name: templateName, startTime, endTime })
      : () => createShiftTemplateAction({ outletId: outlet.id, name: templateName, startTime, endTime });
    execute(action, () => setTemplateOpen(false));
  }

  function beginRevision(userId: string, workDate: string, entry: Entry | null, initial?: string) {
    setRevision({ userId, workDate, entry });
    setRevisionTemplateId(initial ?? entry?.shiftTemplateId ?? templates[0]?.id ?? "");
    setReason("");
  }

  function saveRevision() {
    if (!revision || !week) return;
    const entry = revision.entry;
    const action = revisionTemplateId === FOLLOW_PATTERN
      ? () => resetFixedScheduleOverrideAction({ rosterWeekId: week.id, outletId: outlet.id, userId: revision.userId, workDate: revision.workDate, expectedWeekUpdatedAt: week.updatedAt, reason })
      : entry
        ? () => updatePublishedRosterEntryAction({ entryId: entry.id, shiftTemplateId: revisionTemplateId === DAY_OFF ? null : revisionTemplateId, expectedUpdatedAt: entry.updatedAt, reason })
        : () => addPublishedRosterEntryAction({ rosterWeekId: week.id, outletId: outlet.id, userId: revision.userId, workDate: revision.workDate, shiftTemplateId: revisionTemplateId, expectedWeekUpdatedAt: week.updatedAt, reason });
    execute(action, () => setRevision(null));
  }

  const picker = (userId: string, workDate: string) => {
    const key = `${userId}:${workDate}`;
    const entry = week?.entries.find((item) => item.userId === userId && item.workDate === workDate) ?? null;
    const overridden = overrides.some((item) => item.userId === userId && item.workDate === workDate);
    if (published) {
      if (entry) return <div className="grid gap-1 rounded-lg border border-primary/20 bg-primary/5 p-2"><span className="flex items-center justify-between gap-1 text-xs font-semibold"><span>{entry.shiftName}</span>{overridden && <span className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[.55rem] text-primary uppercase">Khusus</span>}</span><span className="font-mono text-[.65rem] text-muted-foreground">{time(entry.scheduledStartAt, outlet.timezone)}–{time(entry.scheduledEndAt, outlet.timezone)}</span>{new Date(entry.scheduledStartAt) > new Date() && <button className="mt-1 flex min-h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => beginRevision(userId, workDate, entry)} type="button"><Pencil className="size-3" />Ubah</button>}</div>;
      return <div className="grid gap-1 rounded-lg border border-dashed p-2 text-center"><span className="text-xs text-muted-foreground">Libur{overridden ? " · khusus" : ""}</span>{templates.length > 0 && isTodayOrLater(workDate, outlet.timezone) && <button className="flex min-h-8 items-center justify-center gap-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => beginRevision(userId, workDate, null, overridden ? FOLLOW_PATTERN : undefined)} type="button">{overridden ? <Repeat2 className="size-3" /> : <CalendarPlus className="size-3" />}{overridden ? "Atur kembali" : "Tambah shift"}</button>}</div>;
    }
    if (outlet.attendanceScheduleMode === "FIXED") return <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">Dibuat otomatis</div>;
    return <select aria-label={`Shift ${workDate}`} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/40" onChange={(event) => setCells((current) => ({ ...current, [key]: event.target.value }))} value={cells[key] ?? ""}><option value="">Libur</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.startTime}</option>)}</select>;
  };

  const scheduledStaff = staff.filter((person) => weekDays.some((_, index) => fixedCells[`${person.id}:${index + 1}`])).length;
  const fixedPicker = (person: Staff, day: number) => <select aria-label={`Pola ${weekDays[day - 1]} ${person.name}`} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/40" onChange={(event) => setFixedCells((current) => ({ ...current, [`${person.id}:${day}`]: event.target.value }))} value={fixedCells[`${person.id}:${day}`] ?? ""}><option value="">Libur</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · {template.startTime}</option>)}</select>;

  return <div className="grid gap-6">
    <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarCheck2 aria-hidden="true" /></span><div><h2 className="font-heading text-xl font-semibold">Sistem jadwal</h2><p className="mt-1 text-sm text-muted-foreground">Pilihan berlaku khusus untuk {outlet.code} · {outlet.name}.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2"><article className={`rounded-xl border p-4 ${outlet.attendanceScheduleMode === "WEEKLY" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background/55"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Roster mingguan</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Susun draf, salin minggu sebelumnya, lalu terbitkan secara manual.</p></div>{outlet.attendanceScheduleMode === "WEEKLY" && <Badge>Aktif</Badge>}</div>{outlet.attendanceScheduleMode !== "WEEKLY" && <Button className="mt-4 min-h-11 w-full sm:w-auto" disabled={pending} onClick={() => switchMode("WEEKLY")} variant="outline"><ClipboardCopy aria-hidden="true" />Gunakan roster mingguan</Button>}</article><article className={`rounded-xl border p-4 ${outlet.attendanceScheduleMode === "FIXED" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-background/55"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Jadwal tetap</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Pola Senin–Minggu berulang dan roster terbit dibuat otomatis.</p>{outlet.attendanceScheduleMode === "FIXED" && outlet.attendanceScheduleEffectiveFrom && <p className="mt-2 font-mono text-xs text-primary">Mulai {longFixedDate(outlet.attendanceScheduleEffectiveFrom)}</p>}</div>{outlet.attendanceScheduleMode === "FIXED" && <Badge>Aktif</Badge>}</div>{outlet.attendanceScheduleMode !== "FIXED" && <div className="mt-4 flex flex-wrap gap-2"><Button className="min-h-11 flex-1 sm:flex-none" onClick={() => setShowFixedEditor((current) => !current)} variant="outline"><Repeat2 aria-hidden="true" />{showFixedEditor ? "Sembunyikan pola" : "Siapkan jadwal tetap"}</Button>{showFixedEditor && <Button className="min-h-11 flex-1 sm:flex-none" disabled={pending || scheduledStaff !== staff.length || !staff.length} onClick={() => switchMode("FIXED")}><CalendarCheck2 aria-hidden="true" />Gunakan jadwal tetap</Button>}</div>}</article></div></section>

    {(outlet.attendanceScheduleMode === "FIXED" || showFixedEditor) && <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-semibold">Pola jadwal tetap</h2><Badge variant={scheduledStaff === staff.length && staff.length ? "secondary" : "outline"}>{scheduledStaff}/{staff.length} staf siap</Badge></div><p className="mt-1 text-sm text-muted-foreground">Kosong berarti libur. Perubahan pola aktif mulai Senin berikutnya.</p></div><div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={pending || staff.length < 2} onClick={() => setCopyOpen(true)} variant="outline"><Copy aria-hidden="true" />Salin pola</Button><Button className="min-h-11" disabled={pending || !templates.length} onClick={saveFixed}>{pending ? <Spinner /> : <Save aria-hidden="true" />}Simpan pola</Button></div></div>{!staff.length && <p className="mt-5 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada staf aktif dengan jabatan pada outlet ini.</p>}<div className="mt-5 hidden xl:grid xl:grid-cols-[minmax(12rem,1.4fr)_repeat(7,minmax(7.5rem,1fr))] xl:overflow-hidden xl:rounded-xl xl:border"><div className="bg-muted/45 p-3 text-xs font-semibold">Staf</div>{weekDays.map((day) => <div className="border-l bg-muted/45 p-3 text-center text-xs font-semibold" key={day}>{day}</div>)}{staff.flatMap((person) => [<div className="border-t p-3" key={`${person.id}:fixed-name`}><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>, ...weekDays.map((_, index) => <div className="min-w-0 border-t border-l p-2" key={`${person.id}:fixed:${index + 1}`}>{fixedPicker(person, index + 1)}</div>)])}</div><div className="mt-5 grid gap-4 xl:hidden">{weekDays.map((day, index) => <section className="overflow-hidden rounded-xl border" key={day}><header className="bg-muted/45 px-4 py-3"><h3 className="font-semibold">{day}</h3></header><div className="divide-y">{staff.map((person) => <div className="grid gap-2 p-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.2fr)] sm:items-center" key={person.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>{fixedPicker(person, index + 1)}</div>)}</div></section>)}</div></section>}

    <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-heading text-xl font-semibold">Papan mingguan</h2><Badge variant={published ? "default" : "secondary"}>{published ? "Terbit" : outlet.attendanceScheduleMode === "FIXED" ? "Otomatis" : "Draf"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Satu staf hanya dapat memiliki satu shift pada setiap tanggal.</p></div><div className="flex flex-wrap gap-2">{outlet.attendanceScheduleMode === "WEEKLY" && <Button className="min-h-11" disabled={pending || Boolean(week)} onClick={() => execute(() => copyRosterWeekAction({ outletId: outlet.id, sourceWeekStart: addIsoDays(weekStart, -7), targetWeekStart: weekStart }))} variant="outline"><ClipboardCopy aria-hidden="true" />Salin minggu lalu</Button>}<Button className="min-h-11" onClick={() => beginTemplate()} variant="outline"><Plus aria-hidden="true" />Template shift</Button>{outlet.attendanceScheduleMode === "WEEKLY" && !published && <Button className="min-h-11" disabled={pending} onClick={saveDraft}>{pending ? <Spinner /> : <Save aria-hidden="true" />}Simpan draf</Button>}{outlet.attendanceScheduleMode === "WEEKLY" && week && !published && <Button className="min-h-11" disabled={pending || !week.entries.length} onClick={() => execute(() => publishRosterWeekAction({ outletId: outlet.id, weekStart, expectedUpdatedAt: week.updatedAt }))}>{pending ? <Spinner /> : <Send aria-hidden="true" />}Terbitkan</Button>}</div></div>
      {!staff.length && <p className="mt-5 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Belum ada staf aktif dengan jabatan pada outlet ini.</p>}
      <div className="mt-5 hidden xl:grid xl:grid-cols-[minmax(12rem,1.4fr)_repeat(7,minmax(7.5rem,1fr))] xl:overflow-hidden xl:rounded-xl xl:border"><div className="bg-muted/45 p-3 text-xs font-semibold">Staf</div>{dates.map((date) => <div className="border-l bg-muted/45 p-3 text-center" key={date}><span className="block text-xs font-semibold">{weekday(date)}</span><span className="font-mono text-[.65rem] text-muted-foreground">{shortDate(date)}</span></div>)}{staff.flatMap((person) => [<div className="border-t p-3" key={`${person.id}:name`}><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>, ...dates.map((date) => <div className="min-w-0 border-t border-l p-2" key={`${person.id}:${date}`}>{picker(person.id, date)}</div>)])}</div>
      <div className="mt-5 grid gap-4 xl:hidden">{dates.map((date) => <section className="overflow-hidden rounded-xl border" key={date}><header className="flex items-center justify-between bg-muted/45 px-4 py-3"><h3 className="font-semibold">{weekday(date)}</h3><span className="font-mono text-xs text-muted-foreground">{shortDate(date)}</span></header><div className="divide-y">{staff.map((person) => <div className="grid gap-2 p-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.2fr)] sm:items-center" key={person.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{person.name}</p><p className="truncate text-xs text-muted-foreground">{person.jobPosition?.name}</p></div>{picker(person.id, date)}</div>)}</div></section>)}</div>
    </section>

    <section className="rounded-2xl border bg-card p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-heading text-xl font-semibold">Template shift aktif</h2><p className="mt-1 text-sm text-muted-foreground">Perubahan template tidak mengubah snapshot roster yang sudah diterbitkan.</p></div><Button className="min-h-11" onClick={() => beginTemplate()}><Plus aria-hidden="true" />Template baru</Button></div>{templates.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{templates.map((template) => <article className="grid gap-4 rounded-xl border bg-background/55 p-4" key={template.id}><div className="flex min-w-0 items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Clock3 aria-hidden="true" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{template.name}</h3><p className="mt-1 font-mono text-xs text-muted-foreground">{template.startTime}–{template.endTime}</p></div><Badge variant="secondary">Aktif</Badge></div><div className="grid grid-cols-2 gap-2"><Button className="min-h-11" disabled={pending} onClick={() => beginTemplate(template)} variant="outline"><Pencil aria-hidden="true" />Ubah</Button><Button className="min-h-11" disabled={pending} onClick={() => setArchivingTemplate(template)} variant="destructive"><Archive aria-hidden="true" />Arsipkan</Button></div></article>)}</div> : <p className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada template shift aktif.</p>}</section>

    <Dialog onOpenChange={setTemplateOpen} open={templateOpen}><DialogContent><DialogHeader><DialogTitle>{editingTemplate ? "Ubah template shift" : "Template shift baru"}</DialogTitle><DialogDescription>Jika jam selesai tidak lebih besar dari jam mulai, shift dianggap berakhir pada hari berikutnya.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="shift-name">Nama shift</Label><Input autoFocus id="shift-name" maxLength={60} onChange={(event) => setTemplateName(event.target.value)} placeholder="Contoh: Pagi" value={templateName} /></div><div className="grid grid-cols-2 gap-3"><div className="grid min-w-0 gap-2"><Label htmlFor="shift-start">Mulai</Label><Input className="min-w-0" id="shift-start" onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} /></div><div className="grid min-w-0 gap-2"><Label htmlFor="shift-end">Selesai</Label><Input className="min-w-0" id="shift-end" onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} /></div></div></div><DialogFooter><Button disabled={pending} onClick={() => setTemplateOpen(false)} variant="outline">Batal</Button><Button disabled={pending || templateName.trim().length < 2} onClick={saveTemplate}>{pending && <Spinner />}{editingTemplate ? "Simpan perubahan" : "Buat template"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog onOpenChange={(open) => { if (!open) setArchivingTemplate(null); }} open={archivingTemplate !== null}><DialogContent><DialogHeader><DialogTitle>Arsipkan template shift?</DialogTitle><DialogDescription>Template {archivingTemplate?.name} tidak dapat dipilih untuk roster baru. Roster lama tetap utuh.</DialogDescription></DialogHeader><DialogFooter><Button disabled={pending} onClick={() => setArchivingTemplate(null)} variant="outline">Batal</Button><Button disabled={pending} onClick={() => archivingTemplate && execute(() => archiveShiftTemplateAction({ id: archivingTemplate.id, outletId: outlet.id, expectedUpdatedAt: archivingTemplate.updatedAt }), () => setArchivingTemplate(null))} variant="destructive">{pending && <Spinner />}Arsipkan</Button></DialogFooter></DialogContent></Dialog>

    <Dialog onOpenChange={setCopyOpen} open={copyOpen}><DialogContent><DialogHeader><DialogTitle>Salin pola staf</DialogTitle><DialogDescription>Pola Senin–Minggu staf sumber akan menggantikan pola staf tujuan.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>Staf sumber</Label><SearchableSelect aria-label="Staf sumber" onValueChange={(value) => { setCopySource(value); setCopyTargets((current) => current.filter((id) => id !== value)); }} options={staff.map((person) => ({ value: person.id, label: person.name }))} value={copySource} /></div><fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Salin ke</legend>{staff.filter((person) => person.id !== copySource).map((person) => <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm" key={person.id}><Checkbox checked={copyTargets.includes(person.id)} onCheckedChange={(checked) => setCopyTargets((current) => checked ? [...current, person.id] : current.filter((id) => id !== person.id))} /><span className="min-w-0"><span className="block truncate font-medium">{person.name}</span><span className="block truncate text-xs text-muted-foreground">{person.jobPosition?.name}</span></span></label>)}</fieldset></div><DialogFooter><Button onClick={() => setCopyOpen(false)} variant="outline">Batal</Button><Button disabled={!copySource || !copyTargets.length} onClick={copyPattern}><Copy aria-hidden="true" />Salin pola</Button></DialogFooter></DialogContent></Dialog>

    <Dialog onOpenChange={(open) => { if (!open) setRevision(null); }} open={revision !== null}><DialogContent><DialogHeader><DialogTitle>{revision?.entry ? "Ubah jadwal terbit" : "Tambahkan shift"}</DialogTitle><DialogDescription>Hanya jadwal yang belum mulai dapat diubah. Alasan masuk ke audit trail.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label>Jadwal baru</Label><SearchableSelect aria-label="Jadwal baru" onValueChange={setRevisionTemplateId} options={revision?.entry ? templateOptions : templateOptions.filter((option) => option.value !== DAY_OFF)} value={revisionTemplateId} /></div><div className="grid gap-2"><Label htmlFor="roster-reason">Alasan perubahan</Label><Textarea id="roster-reason" maxLength={240} onChange={(event) => setReason(event.target.value)} placeholder="Alasan perubahan minimal 8 karakter" value={reason} /></div></div><DialogFooter><Button disabled={pending} onClick={() => setRevision(null)} variant="outline">Batal</Button><Button disabled={pending || reason.trim().length < 8 || !revisionTemplateId} onClick={saveRevision}>{pending && <Spinner />}Simpan perubahan</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function weekday(value: string) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function shortDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function time(value: string, timezone: string) { return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(value)); }
function isTodayOrLater(value: string, timezone: string) { return value >= new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function longFixedDate(value: string) { return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
