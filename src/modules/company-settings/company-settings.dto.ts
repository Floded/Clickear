import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional(),
  );

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().trim().email("Correo electrónico inválido").max(255).optional(),
);

function normalizeCuit(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function isValidCuit(cuit: string): boolean {
  const digits = normalizeCuit(cuit);
  if (!/^\d{11}$/.test(digits)) return false;

  const nums = digits.split("").map((d) => Number.parseInt(d, 10));
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + weight * nums[index], 0);
  const mod = sum % 11;
  let check = 11 - mod;
  if (check === 11) check = 0;
  if (check === 10) check = 9;
  return check === nums[10];
}

const optionalCuit = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(20)
    .refine((value) => isValidCuit(value), { message: "CUIT inválido" })
    .optional(),
);

export const updateCompanySettingsSchema = z.object({
  commercialName: optionalTrimmedString(255),
  legalName: optionalTrimmedString(255),

  responsibleName: optionalTrimmedString(255),
  responsiblePosition: optionalTrimmedString(255),

  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  locality: optionalTrimmedString(100),
  province: optionalTrimmedString(100),
  country: optionalTrimmedString(100),
  postalCode: optionalTrimmedString(20),
  email: optionalEmail,
  phone: optionalTrimmedString(50),

  taxId: optionalCuit,
  grossIncomeNumber: optionalTrimmedString(50),
  rupeNumber: optionalTrimmedString(50),
});

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;

export function normalizeCompanySettingsInput(input: UpdateCompanySettingsInput) {
  const data: Record<string, string | null> = {};

  if ("commercialName" in input) data.commercialName = input.commercialName ?? null;
  if ("legalName" in input) data.legalName = input.legalName ?? null;
  if ("responsibleName" in input) data.responsibleName = input.responsibleName ?? null;
  if ("responsiblePosition" in input) data.responsiblePosition = input.responsiblePosition ?? null;
  if ("address" in input) data.address = input.address ?? null;
  if ("locality" in input) data.locality = input.locality ?? null;
  if ("province" in input) data.province = input.province ?? null;
  if ("country" in input) data.country = input.country ?? null;
  if ("postalCode" in input) data.postalCode = input.postalCode ?? null;
  if ("email" in input) data.email = input.email?.toLowerCase() ?? null;
  if ("phone" in input) data.phone = input.phone ? input.phone.replace(/\s+/g, " ").trim() : null;
  if ("taxId" in input) data.taxId = input.taxId ? normalizeCuit(input.taxId) : null;
  if ("grossIncomeNumber" in input) {
    data.grossIncomeNumber = input.grossIncomeNumber
      ? input.grossIncomeNumber.replace(/\s+/g, "").trim()
      : null;
  }
  if ("rupeNumber" in input) {
    data.rupeNumber = input.rupeNumber ? input.rupeNumber.replace(/\s+/g, "").trim() : null;
  }

  return data;
}
