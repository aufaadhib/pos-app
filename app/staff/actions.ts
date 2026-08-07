"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  createStaff,
  deactivateStaff,
  reactivateStaff,
  resetStaffPassword,
  StaffError,
  updateStaff,
} from "@/lib/staff/service";
import type { StaffActionState } from "@/lib/staff/types";
import {
  createStaffSchema,
  staffMutationTargetSchema,
  updateStaffSchema,
} from "@/lib/staff/validation";

export async function createStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return executeStaffAction(createStaffSchema, formData, async (input, actor) => {
    const result = await createStaff(input, actor);
    return {
      message: "Staf berhasil dibuat. Salin kata sandi sementara sekarang.",
      credentials: { name: result.user.name, email: result.user.email, password: result.password },
    };
  });
}

export async function updateStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return executeStaffAction(updateStaffSchema, formData, async (input, actor) => {
    await updateStaff(input, actor);
    return { message: "Data dan penugasan staf berhasil diperbarui." };
  });
}

export async function deactivateStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return executeStaffAction(staffMutationTargetSchema, formData, async (input, actor) => {
    await deactivateStaff(input, actor);
    return { message: "Akun staf dinonaktifkan dan seluruh session dicabut." };
  });
}

export async function reactivateStaffAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return executeStaffAction(staffMutationTargetSchema, formData, async (input, actor) => {
    await reactivateStaff(input, actor);
    return { message: "Akun staf kembali aktif." };
  });
}

export async function resetStaffPasswordAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  return executeStaffAction(staffMutationTargetSchema, formData, async (input, actor) => {
    const result = await resetStaffPassword(input, actor);
    return {
      message: "Kata sandi sementara baru dibuat dan seluruh session lama dicabut.",
      credentials: { name: result.user.name, email: result.user.email, password: result.password },
    };
  });
}

async function executeStaffAction<Input>(
  schema: ZodType<Input>,
  formData: FormData,
  mutation: (
    input: Input,
    actor: { id: string; email: string; role: "owner" | "manager" | "cashier" },
  ) => Promise<{ message: string; credentials?: StaffActionState["credentials"] }>,
): Promise<StaffActionState> {
  const session = await requirePermission({ staff: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const raw = { ...Object.fromEntries(formData), outletIds: formData.getAll("outletIds") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali data staf.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await mutation(parsed.data, {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });
    revalidatePath("/staff");
    revalidatePath("/outlets");
    revalidatePath("/select-outlet");
    return { status: "success", ...result };
  } catch (error) {
    if (error instanceof StaffError) {
      return {
        status: error.code === "CONFLICT" ? "conflict" : "error",
        message: error.message,
      };
    }
    console.error("Staff mutation failed", error);
    return { status: "error", message: "Perubahan staf belum dapat disimpan. Coba lagi." };
  }
}
