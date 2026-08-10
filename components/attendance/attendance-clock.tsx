"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClockArrowDown, ClockArrowUp, ScanFace, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "react-toastify";

import { requestAttendanceExceptionAction } from "@/app/attendance/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceChallengeAction } from "@/lib/attendance/constants";
import { getSharedDevicePreference, setSharedDevicePreference, subscribeSharedDevicePreference } from "@/lib/attendance/device-preference";
import { authClient } from "@/lib/auth/client";

type AttendanceOutlet = { id: string; code: string; name: string; attendanceEnabled: boolean; attendanceLatitude: number | null; attendanceLongitude: number | null; attendanceRadiusMeters: number };
type RecentSession = { id: string; status: "OPEN" | "CLOSED"; checkInAt: string; checkOutAt: string | null; outlet: { code: string; name: string; timezone: string }; correction: { reason: string } | null };
type HumanInstance = { load: () => Promise<unknown>; detect: (input: HTMLVideoElement) => Promise<{ face: Array<{ embedding?: number[]; real?: number; live?: number }>; gesture: Array<{ gesture: string }> }> };

/** Runs enrollment and 1:1 attendance for the signed-in account with optional shared-device logout. */
export function AttendanceClock({ user, outlets, profile, openSession, recentSessions }: {
  user: { name: string; email: string };
  outlets: AttendanceOutlet[];
  profile: { enrolledAt: string; modelVersion: string } | null;
  openSession: { id: string; checkInAt: string; outlet: { id: string; code: string; name: string } } | null;
  recentSessions: RecentSession[];
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanInstance | null>(null);
  const [selectedOutletId, setSelectedOutletId] = useState(openSession?.outlet.id ?? outlets[0]?.id ?? "");
  const [dialogMode, setDialogMode] = useState<"enroll" | "verify" | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [consent, setConsent] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [challenge, setChallenge] = useState<{ verificationId: string; nonce: string; action: AttendanceChallengeAction; actionLabel: string } | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionAvailable, setExceptionAvailable] = useState(false);
  const [pending, startTransition] = useTransition();
  const subscribeSharedDevice = useCallback((onChange: () => void) => subscribeSharedDevicePreference(onChange), []);
  const sharedDevice = useSyncExternalStore(subscribeSharedDevice, getSharedDevicePreference, getManualSharedDeviceSnapshot);
  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId);
  const attendanceKind = openSession ? "CHECK_OUT" : "CHECK_IN";

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function changeSharedDevice(enabled: boolean) {
    if (!setSharedDevicePreference(enabled)) {
      toast.error("Penyimpanan browser tidak tersedia. Logout otomatis tetap nonaktif.");
    }
  }

  async function openEnrollment() {
    setSamples([]);
    setConsent(false);
    setDialogMode("enroll");
    await startCamera();
  }

  async function openVerification() {
    if (!selectedOutlet?.attendanceEnabled) return toast.error("Absensi belum diaktifkan pada outlet ini.");
    if (!profile) return toast.error("Daftarkan wajah akun ini terlebih dahulu.");
    setExceptionAvailable(false);
    setExceptionReason("");
    setDialogMode("verify");
    setCameraStatus("loading");
    try {
      const response = await fetch("/api/attendance/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outletId: selectedOutlet.id, kind: attendanceKind }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setChallenge(data);
      await startCamera();
    } catch (error) {
      setCameraStatus("error");
      toast.error(error instanceof Error ? error.message : "Challenge belum dapat dibuat.");
    }
  }

  async function startCamera() {
    setCameraStatus("loading");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!humanRef.current) humanRef.current = await loadHuman();
      setCameraStatus("ready");
    } catch (error) {
      console.error("Attendance camera startup failed", error);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraStatus("error");
    }
  }

  function closeDialog() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setDialogMode(null);
    setCameraStatus("idle");
    setChallenge(null);
  }

  function captureEnrollmentSample() {
    startTransition(async () => {
      try {
        if (!consent) throw new Error("Setujui penggunaan template wajah terlebih dahulu.");
        let nextSamples = samples.slice(0, 3);
        if (nextSamples.length !== samples.length) setSamples(nextSamples);
        if (nextSamples.length < 3) {
          const detection = await detectFace(humanRef.current, videoRef.current);
          nextSamples = [...nextSamples, detection.embedding].slice(0, 3);
          setSamples(nextSamples);
        }
        if (nextSamples.length < 3) {
          toast.success(`Sampel ${nextSamples.length} dari 3 tersimpan. Ubah sedikit sudut wajah.`);
          return;
        }
        const response = await fetch("/api/attendance/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ samples: nextSamples, modelVersion: "human-3.3.6", consent: true }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        toast.success("Wajah akun berhasil didaftarkan.");
        closeDialog();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Sampel wajah belum dapat disimpan.");
      }
    });
  }

  function verify() {
    startTransition(async () => {
      try {
        if (!challenge || !selectedOutlet) throw new Error("Muat challenge baru terlebih dahulu.");
        const detection = await detectFace(humanRef.current, videoRef.current);
        const livenessPassed = challengePassed(challenge.action, detection.gestures) && detection.real >= 0.5 && detection.live >= 0.5;
        const [location, evidence] = await Promise.all([readLocation(), captureEvidence(videoRef.current)]);
        const payload = { verificationId: challenge.verificationId, nonce: challenge.nonce, idempotencyKey: crypto.randomUUID(), embedding: detection.embedding, livenessPassed, location };
        const formData = new FormData();
        formData.set("payload", JSON.stringify(payload));
        formData.set("evidence", evidence, "attendance.jpg");
        const response = await fetch("/api/attendance/verify", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!data.success) {
          setExceptionAvailable(Boolean(data.exceptionAvailable));
          toast.error(`${data.message} Percobaan ${data.attemptCount} dari 3.`);
          if (!data.exceptionAvailable) await refreshChallenge();
          return;
        }
        toast.success(attendanceKind === "CHECK_IN" ? "Absensi masuk berhasil." : "Absensi pulang berhasil.");
        closeDialog();
        if (sharedDevice) await signOutSharedDevice();
        else router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Absensi belum dapat diproses.");
      }
    });
  }

  async function refreshChallenge() {
    if (!selectedOutlet) return;
    const response = await fetch("/api/attendance/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outletId: selectedOutlet.id, kind: attendanceKind }) });
    const data = await response.json();
    if (response.ok) setChallenge(data);
  }

  function requestException() {
    if (!challenge) return;
    startTransition(async () => {
      const result = await requestAttendanceExceptionAction({ verificationId: challenge.verificationId, reason: exceptionReason });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      closeDialog();
      if (sharedDevice) await signOutSharedDevice();
      else router.refresh();
    });
  }

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] xl:items-start">
    <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
      <div className="border-l-4 border-success p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-medium text-muted-foreground">Akun yang akan diverifikasi</p><h2 className="mt-1 font-heading text-2xl font-semibold">{user.name}</h2><p className="mt-1 text-sm text-muted-foreground">{user.email}</p></div>
          <Badge className="w-fit gap-1.5 border-success/35 bg-success/10 text-success" variant="outline"><CheckCircle2 aria-hidden="true" />Verifikasi 1:1</Badge>
        </div>
      </div>
      <div className="grid gap-5 border-t p-4 sm:p-6">
        <label className="grid gap-2" htmlFor="attendance-outlet"><span className="font-semibold">Outlet absensi</span><Select onValueChange={(value) => value && setSelectedOutletId(value)} value={selectedOutletId}><SelectTrigger className="h-11 w-full" id="attendance-outlet"><SelectValue>{selectedOutlet ? `${selectedOutlet.code} · ${selectedOutlet.name}` : "Pilih outlet"}</SelectValue></SelectTrigger><SelectContent>{outlets.map((outlet) => <SelectItem key={outlet.id} value={outlet.id}>{outlet.code} · {outlet.name}</SelectItem>)}</SelectContent></Select></label>
        {!outlets.length && <Alert variant="destructive"><ShieldAlert aria-hidden="true" /><AlertTitle>Belum ada outlet</AlertTitle><AlertDescription>Akun Anda belum ditugaskan pada outlet aktif. Hubungi pemilik atau manajer.</AlertDescription></Alert>}
        {selectedOutlet && !selectedOutlet.attendanceEnabled && <Alert><ShieldAlert aria-hidden="true" /><AlertTitle>Absensi outlet nonaktif</AlertTitle><AlertDescription>Manajer perlu mengatur titik lokasi dan mengaktifkan absensi outlet ini.</AlertDescription></Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button className="min-h-12" onClick={openEnrollment} type="button" variant="outline"><ScanFace aria-hidden="true" />{profile ? "Daftarkan ulang wajah" : "Daftarkan wajah"}</Button>
          <Button className="min-h-12" disabled={!selectedOutlet?.attendanceEnabled || !profile} onClick={openVerification} type="button">{openSession ? <ClockArrowDown aria-hidden="true" /> : <ClockArrowUp aria-hidden="true" />}{openSession ? "Absensi pulang" : "Absensi masuk"}</Button>
        </div>
        <div className="flex min-h-14 items-start justify-between gap-4 rounded-xl border bg-muted/35 p-4"><span><span className="flex items-center gap-2 font-semibold"><Smartphone aria-hidden="true" className="size-4" />Tablet bersama</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Logout otomatis setelah absensi atau pengecualian dikirim.</span></span><Switch aria-label="Logout otomatis pada tablet bersama" checked={sharedDevice} onCheckedChange={changeSharedDevice} /></div>
      </div>
    </section>

    <aside className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-heading text-xl font-semibold">Status hari ini</h2><p className="mt-1 text-sm text-muted-foreground">Waktu berasal dari server.</p></div><Badge variant={openSession ? "default" : "secondary"}>{openSession ? "Sedang masuk" : "Belum masuk"}</Badge></div>
      {openSession ? <div className="mt-5 rounded-xl border border-success/30 bg-success/10 p-4"><p className="font-semibold text-success">{openSession.outlet.code} · {openSession.outlet.name}</p><p className="mt-1 text-sm text-muted-foreground">Masuk {formatAttendanceTime(openSession.checkInAt)}</p></div> : <p className="mt-5 rounded-xl border border-dashed p-4 text-sm leading-6 text-muted-foreground">Belum ada sesi terbuka. Pilih outlet lalu lakukan absensi masuk.</p>}
      <div className="mt-6"><h3 className="font-semibold">Riwayat terakhir</h3><div className="mt-3 grid gap-2">{recentSessions.length ? recentSessions.slice(0, 5).map((session) => <div className="rounded-lg border p-3 text-sm" key={session.id}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{session.outlet.code}</span><Badge variant="outline">{session.status === "OPEN" ? "Terbuka" : "Selesai"}</Badge></div><p className="mt-1 text-muted-foreground">{formatAttendanceTime(session.checkInAt)} — {session.checkOutAt ? formatAttendanceTime(session.checkOutAt) : "Belum pulang"}</p>{session.correction && <p className="mt-1 text-xs text-primary">Dikoreksi: {session.correction.reason}</p>}</div>) : <p className="text-sm text-muted-foreground">Belum ada riwayat absensi.</p>}</div></div>
    </aside>

    <Dialog onOpenChange={(open) => { if (!open) closeDialog(); }} open={dialogMode !== null}><DialogContent className="sm:w-[min(34rem,calc(100vw-3rem))]"><DialogHeader><DialogTitle>{dialogMode === "enroll" ? "Daftarkan wajah akun" : openSession ? "Verifikasi absensi pulang" : "Verifikasi absensi masuk"}</DialogTitle><DialogDescription>{dialogMode === "enroll" ? "Ambil tiga sampel wajah terang dan tajam. Template disimpan terenkripsi." : challenge?.actionLabel ?? "Menyiapkan challenge liveness…"}</DialogDescription></DialogHeader>
      <div className="relative mx-auto aspect-[3/4] w-[min(100%,21rem,39svh)] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <video aria-label="Pratinjau kamera absensi" className="h-full w-full scale-x-[-1] object-cover" muted playsInline ref={videoRef} />
        {cameraStatus !== "ready" && <div aria-hidden="true" className="absolute inset-0 z-20 bg-black/65" />}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-[7%] z-30 h-[86%] w-[86%] text-white/80 drop-shadow-[0_1px_2px_rgb(0_0_0/70%)]" data-testid="face-position-guide" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 240 320">
          <ellipse cx="120" cy="121" rx="67" ry="88" />
          <path d="M92 119c8-6 17-6 25 0M123 119c8-6 17-6 25 0M120 132v27l-9 7M101 183c12 9 26 9 38 0" opacity=".72" />
          <path d="M86 198v21c0 18-14 23-31 34-18 12-28 34-31 57M154 198v21c0 18 14 23 31 34 18 12 28 34 31 57M24 310h192" />
        </svg>
        {cameraStatus !== "ready" && <div className="absolute inset-x-3 bottom-3 z-40 rounded-xl bg-black/70 px-3 py-2.5 text-center text-sm font-semibold text-white backdrop-blur-sm" role="status">{cameraStatus === "loading" ? <span className="flex items-center justify-center gap-2"><Spinner className="size-5" />Memuat kamera dan model wajah…</span> : cameraStatus === "error" ? <span>Kamera atau model wajah tidak tersedia. Periksa izin kamera dan koneksi.</span> : null}</div>}
      </div>
      <p className="text-center text-sm font-medium text-muted-foreground">Tegakkan kepala, arahkan mata ke kamera, lalu sejajarkan wajah dengan sketsa.</p>
      {dialogMode === "enroll" && <label className="flex min-h-12 items-start gap-3 rounded-xl border p-3" htmlFor="face-consent"><Checkbox checked={consent} id="face-consent" onCheckedChange={(value) => setConsent(value === true)} /><span className="text-sm leading-5">Saya menyetujui pembuatan template wajah terenkripsi untuk absensi dan dapat meminta profil dibatalkan.</span></label>}
      {dialogMode === "verify" && challenge && <Alert className={exceptionAvailable ? "border-destructive/40 bg-destructive/10" : "border-success/30 bg-success/10"}><Camera aria-hidden="true" /><AlertTitle>{exceptionAvailable ? "Pengecualian tersedia" : challenge.actionLabel}</AlertTitle><AlertDescription>{exceptionAvailable ? "Tiga percobaan gagal. Jelaskan kendala agar manajer dapat meninjau." : "Lakukan gerakan lalu tekan Ambil dan verifikasi. Pastikan hanya satu wajah terlihat."}</AlertDescription></Alert>}
      {exceptionAvailable && <Textarea aria-label="Alasan permintaan pengecualian" maxLength={240} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Contoh: kamera tablet buram meskipun lokasi sudah sesuai" rows={3} value={exceptionReason} />}
      <DialogFooter><Button disabled={pending} onClick={closeDialog} type="button" variant="outline">Batal</Button>{dialogMode === "enroll" ? <Button disabled={pending || cameraStatus !== "ready" || !consent} onClick={captureEnrollmentSample} type="button">{pending ? <Spinner /> : <Camera aria-hidden="true" />}{pending ? "Memproses…" : samples.length === 3 ? "Coba simpan lagi" : `Ambil sampel ${samples.length + 1}/3`}</Button> : exceptionAvailable ? <Button disabled={pending || exceptionReason.trim().length < 8} onClick={requestException} type="button" variant="destructive">{pending ? <Spinner /> : <ShieldAlert aria-hidden="true" />}{pending ? "Mengirim…" : "Kirim pengecualian"}</Button> : <Button disabled={pending || cameraStatus !== "ready" || !challenge} onClick={verify} type="button">{pending ? <Spinner /> : <ScanFace aria-hidden="true" />}{pending ? "Memverifikasi…" : "Ambil dan verifikasi"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

async function loadHuman(): Promise<HumanInstance> {
  const { default: Human } = await import("@vladmandic/human");
  const baseConfig = { modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/", debug: false, face: { enabled: true, detector: { enabled: true, maxDetected: 1 }, mesh: { enabled: true }, description: { enabled: true }, iris: { enabled: true }, antispoof: { enabled: true }, liveness: { enabled: true }, emotion: { enabled: false }, age: { enabled: false }, gender: { enabled: false } }, body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, gesture: { enabled: true } };
  try {
    const human = new Human({ ...baseConfig, backend: "webgl" } as never) as HumanInstance;
    await human.load();
    return human;
  } catch {
    const human = new Human({ ...baseConfig, backend: "wasm" } as never) as HumanInstance;
    await human.load();
    return human;
  }
}

async function detectFace(human: HumanInstance | null, video: HTMLVideoElement | null) {
  if (!human || !video) throw new Error("Kamera belum siap.");
  const result = await human.detect(video);
  if (result.face.length !== 1 || !result.face[0]?.embedding) throw new Error("Pastikan tepat satu wajah terlihat jelas.");
  return { embedding: result.face[0].embedding, real: result.face[0].real ?? 1, live: result.face[0].live ?? 1, gestures: result.gesture.map((item) => item.gesture) };
}

function challengePassed(action: AttendanceChallengeAction, gestures: string[]) {
  if (action === "BLINK") return gestures.some((gesture) => gesture.startsWith("blink "));
  if (action === "TURN_LEFT") return gestures.includes("facing left");
  return gestures.includes("facing right");
}

function readLocation(): Promise<{ latitude: number; longitude: number; accuracyMeters: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Perangkat tidak menyediakan lokasi."));
    navigator.geolocation.getCurrentPosition((position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }), () => reject(new Error("Lokasi tidak dapat dibaca. Izinkan lokasi lalu coba kembali.")), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 });
  });
}

async function captureEvidence(video: HTMLVideoElement | null) {
  if (!video?.videoWidth || !video.videoHeight) throw new Error("Frame kamera belum siap.");
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 480 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.72, 0.6, 0.48]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 300 * 1024) return blob;
  }
  throw new Error("Foto bukti terlalu besar untuk dikirim.");
}

async function signOutSharedDevice() {
  const result = await authClient.signOut();
  if (result.error) throw new Error("Absensi tersimpan, tetapi logout otomatis gagal. Keluar secara manual sebelum tablet dipakai staf lain.");
  window.location.replace("/sign-in");
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getManualSharedDeviceSnapshot() {
  return false;
}
