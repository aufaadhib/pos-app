"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  archiveOutlet,
  createOutlet,
  OutletError,
  restoreOutlet,
  updateOutlet,
} from "@/lib/outlets/service";
import type { OutletActionState } from "@/lib/outlets/types";
import {
  createOutletSchema,
  outletMutationTargetSchema,
  updateOutletSchema,
} from "@/lib/outlets/validation";
import { RegionServiceError, validateRegionSelection } from "@/lib/regions/service";

export async function createOutletAction(_state: OutletActionState, formData: FormData) {
  return executeOutletAction(createOutletSchema, formData, async (input, actor) => {
    const region = await validateRegionSelection(input);
    return createOutlet({ ...input, ...region }, actor);
  }, "Outlet berhasil dibuat.");
}

export async function updateOutletAction(_state: OutletActionState, formData: FormData) {
  return executeOutletAction(updateOutletSchema, formData, async (input, actor) => {
    const region = await validateRegionSelection(input);
    return updateOutlet({ ...input, ...region }, actor);
  }, "Outlet berhasil diperbarui.");
}

export async function archiveOutletAction(_state: OutletActionState, formData: FormData) {
  return executeOutletAction(outletMutationTargetSchema, formData, archiveOutlet, "Outlet berhasil diarsipkan.");
}

export async function restoreOutletAction(_state: OutletActionState, formData: FormData) {
  return executeOutletAction(outletMutationTargetSchema, formData, restoreOutlet, "Outlet berhasil dipulihkan.");
}

async function executeOutletAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (input: Input, actor: { id: string; email: string; role: "owner" | "manager" | "cashier" }) => Promise<unknown>,
  successMessage: string,
): Promise<OutletActionState> {
  const session = await requirePermission({ outlet: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali data outlet.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await mutation(parsed.data, { id: session.user.id, email: session.user.email, role: session.user.role });
    revalidatePath("/outlets");
    revalidatePath("/select-outlet");
    revalidatePath("/workspace");
    return { status: "success", message: successMessage };
  } catch (error) {
    if (error instanceof OutletError || error instanceof RegionServiceError) {
      return {
        status: error instanceof OutletError && error.code === "CONFLICT" ? "conflict" : "error",
        message: error.message,
      };
    }
    console.error("Outlet mutation failed", error);
    return { status: "error", message: "Perubahan outlet belum dapat disimpan. Coba lagi." };
  }
}
