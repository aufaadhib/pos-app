const maxEmbeddingLength = 2048;

/** Validates and L2-normalizes one face embedding before matching or storage. */
export function normalizeEmbedding(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 32 || value.length > maxEmbeddingLength) {
    throw new Error("Template wajah tidak valid.");
  }
  const embedding = value.map(Number);
  if (embedding.some((item) => !Number.isFinite(item))) throw new Error("Template wajah tidak valid.");
  const magnitude = Math.hypot(...embedding);
  if (!Number.isFinite(magnitude) || magnitude === 0) throw new Error("Template wajah tidak valid.");
  return embedding.map((item) => item / magnitude);
}

/** Averages equal-length enrollment samples and returns a normalized template. */
export function averageEmbeddings(samples: unknown): number[] {
  if (!Array.isArray(samples) || samples.length !== 3) {
    throw new Error("Pendaftaran wajah membutuhkan tepat tiga sampel.");
  }
  const normalized = samples.map(normalizeEmbedding);
  const length = normalized[0]?.length ?? 0;
  if (normalized.some((sample) => sample.length !== length)) throw new Error("Ukuran sampel wajah tidak konsisten.");
  return normalizeEmbedding(Array.from({ length }, (_, index) => normalized.reduce((sum, sample) => sum + sample[index], 0) / normalized.length));
}

/** Returns cosine similarity for two normalized face embeddings of equal length. */
export function faceSimilarity(left: unknown, right: unknown) {
  const a = normalizeEmbedding(left);
  const b = normalizeEmbedding(right);
  if (a.length !== b.length) throw new Error("Versi template wajah tidak cocok.");
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}
