import "server-only";

import { z } from "zod";

const regionSchema = z.object({
  code: z.string(),
  name: z.string(),
});

const regionResponseSchema = z.object({
  status: z.literal("success"),
  data: z.array(regionSchema),
});

const regionApiBaseUrl = "https://wilayah.web.id/api";

export type RegionOption = z.infer<typeof regionSchema>;

export class RegionServiceError extends Error {
  constructor(message = "Data wilayah belum dapat dimuat. Coba beberapa saat lagi.") {
    super(message);
    this.name = "RegionServiceError";
  }
}

export async function getProvinces() {
  return fetchRegions(`${regionApiBaseUrl}/provinces?limit=50`);
}

export async function getRegencies(provinceCode: string) {
  if (!/^\d{2}$/.test(provinceCode)) {
    throw new RegionServiceError("Kode provinsi tidak valid.");
  }

  return fetchRegions(`${regionApiBaseUrl}/regencies/${provinceCode}?limit=100`);
}

export async function validateRegionSelection(input: {
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
}) {
  const [provinces, regencies] = await Promise.all([
    getProvinces(),
    getRegencies(input.provinceCode),
  ]);
  const province = provinces.find((item) => item.code === input.provinceCode);
  const city = regencies.find((item) => item.code === input.cityCode);

  if (!province || !city) {
    throw new RegionServiceError("Provinsi atau kabupaten/kota tidak sesuai dengan data wilayah.");
  }

  return {
    provinceCode: province.code,
    provinceName: province.name,
    cityCode: city.code,
    cityName: city.name,
  };
}

async function fetchRegions(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new RegionServiceError();
    }

    return regionResponseSchema.parse(await response.json()).data;
  } catch (error) {
    if (error instanceof RegionServiceError) throw error;
    throw new RegionServiceError();
  }
}
