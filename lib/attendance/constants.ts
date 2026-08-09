export const attendanceSimilarityThreshold = 0.6;
export const attendanceVerificationMinutes = 15;
export const attendanceEvidenceRetentionDays = 30;
export const attendanceMaxGpsAccuracyMeters = 100;
export const attendanceRadiusRange = { min: 50, max: 500 } as const;
export const attendanceSharedDeviceKey = "glutong:attendance:shared-device";

export const attendanceChallengeLabels = {
  BLINK: "Kedipkan kedua mata",
  TURN_LEFT: "Hadapkan wajah sedikit ke kiri",
  TURN_RIGHT: "Hadapkan wajah sedikit ke kanan",
} as const;

export type AttendanceChallengeAction = keyof typeof attendanceChallengeLabels;
