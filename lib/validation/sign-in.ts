import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Masukkan alamat email yang valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});

export type SignInValues = z.infer<typeof signInSchema>;
