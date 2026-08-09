"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Crosshair, MapPin, Save, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";

import { updateAttendanceSettingsAction } from "@/app/settings/attendance-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

const AttendanceMap = dynamic(() => import("@/components/attendance/attendance-map"), {
  ssr: false,
  loading: () => <Skeleton aria-label="Memuat peta lokasi" className="h-[22rem] w-full rounded-xl sm:h-[26rem]" />,
});

type AttendanceSettingsOutlet = {
  id: string;
  code: string;
  name: string;
  attendanceEnabled: boolean;
  attendanceLatitude: number | null;
  attendanceLongitude: number | null;
  attendanceRadiusMeters: number;
};

const defaultMapCenter = { latitude: -6.2, longitude: 106.816666 };

/** Synchronizes map handles, numeric fields, current location, and the persisted outlet geofence. */
export function AttendanceSettingsForm({ outlet }: { outlet: AttendanceSettingsOutlet }) {
  const [enabled, setEnabled] = useState(outlet.attendanceEnabled);
  const [latitude, setLatitude] = useState<number | null>(outlet.attendanceLatitude);
  const [longitude, setLongitude] = useState<number | null>(outlet.attendanceLongitude);
  const [radiusMeters, setRadiusMeters] = useState(outlet.attendanceRadiusMeters);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();
  const mapValue = { latitude: latitude ?? defaultMapCenter.latitude, longitude: longitude ?? defaultMapCenter.longitude, radiusMeters };

  function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error("Perangkat ini tidak menyediakan lokasi.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocating(false);
        toast.success("Titik pusat mengikuti lokasi perangkat saat ini.");
      },
      () => {
        setLocating(false);
        toast.error("Lokasi tidak dapat dibaca. Izinkan lokasi atau isi koordinat manual.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function save() {
    startTransition(async () => {
      const result = await updateAttendanceSettingsAction({ outletId: outlet.id, attendanceEnabled: enabled, latitude, longitude, radiusMeters });
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)] xl:items-start">
    <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="font-heading text-xl font-semibold">Cakupan absensi</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Radius berlaku untuk check-in dan check-out outlet ini.</p></div>
        <Badge className={enabled ? "border-success/35 bg-success/10 text-success" : ""} variant="outline">{enabled ? "Aktif" : "Nonaktif"}</Badge>
      </div>
      <div className="mt-6 grid gap-5">
        <label className="flex min-h-14 items-start justify-between gap-4 rounded-xl border p-4" htmlFor="attendance-enabled">
          <span><span className="block font-semibold">Aktifkan absensi outlet</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Staf yang ditugaskan dapat melakukan absensi di dalam radius.</span></span>
          <Switch checked={enabled} disabled={latitude === null || longitude === null} id="attendance-enabled" onCheckedChange={setEnabled} />
        </label>
        <Button className="min-h-11 w-full" disabled={locating} onClick={useCurrentLocation} type="button" variant="outline">{locating ? <Spinner /> : <Crosshair aria-hidden="true" />}{locating ? "Mencari lokasi…" : "Gunakan lokasi saya"}</Button>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2"><Label htmlFor="attendance-latitude">Latitude</Label><Input id="attendance-latitude" inputMode="decimal" onChange={(event) => setLatitude(parseOptionalNumber(event.target.value))} placeholder="-6.200000" step="0.000001" type="number" value={latitude ?? ""} /></div>
          <div className="grid gap-2"><Label htmlFor="attendance-longitude">Longitude</Label><Input id="attendance-longitude" inputMode="decimal" onChange={(event) => setLongitude(parseOptionalNumber(event.target.value))} placeholder="106.816666" step="0.000001" type="number" value={longitude ?? ""} /></div>
        </div>
        <div className="grid gap-2"><Label htmlFor="attendance-radius">Radius kehadiran</Label><div className="relative"><Input className="h-11 pr-16" id="attendance-radius" max={500} min={50} onChange={(event) => setRadiusMeters(Math.min(500, Math.max(50, Number(event.target.value) || 50)))} step={10} type="number" value={radiusMeters} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">meter</span></div><p className="text-xs text-muted-foreground">Minimal 50 m, maksimal 500 m. Handle hijau pada peta mengikuti angka ini.</p></div>
        <Alert><ShieldCheck aria-hidden="true" /><AlertTitle>Validasi lokasi</AlertTitle><AlertDescription>Pembacaan GPS dengan akurasi lebih dari 100 meter akan ditolak. Lokasi hanya dibaca ketika staf menjalankan absensi.</AlertDescription></Alert>
        <Button className="min-h-11 w-full" disabled={pending} onClick={save} type="button">{pending ? <Spinner /> : <Save aria-hidden="true" />}{pending ? "Menyimpan…" : "Simpan pengaturan"}</Button>
      </div>
    </section>
    <section aria-labelledby="attendance-map-heading" className="min-w-0 rounded-2xl border bg-card p-3 sm:p-5">
      <div className="mb-4 flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><MapPin aria-hidden="true" /></span><div><h2 className="font-heading text-xl font-semibold" id="attendance-map-heading">Peta radius outlet</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">Geser titik merah untuk pusat outlet atau handle hijau untuk radius.</p></div></div>
      <AttendanceMap onChange={(next) => { setLatitude(next.latitude); setLongitude(next.longitude); setRadiusMeters(next.radiusMeters); }} value={mapValue} />
      {latitude === null && <p className="mt-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Peta sementara dipusatkan di Jakarta. Gunakan lokasi perangkat, geser titik, atau isi koordinat agar dapat disimpan.</p>}
    </section>
  </div>;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
