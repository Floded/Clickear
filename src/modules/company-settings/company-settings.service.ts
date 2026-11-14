import { prisma } from "../../prisma/client.js";
import type { Prisma } from "@prisma/client";

import type { UpdateCompanySettingsInput } from "./company-settings.dto.js";
import { normalizeCompanySettingsInput } from "./company-settings.dto.js";

const COMPANY_SETTINGS_ID = 1;

const INITIAL_COMPANY_SETTINGS = {
  id: COMPANY_SETTINGS_ID,
  commercialName: null,
  legalName: null,
  logoUrl: null,
  logoPath: null,
  signatureUrl: null,
  signaturePath: null,
  responsibleName: "Ricardo Gabriel Lillo Morales",
  responsiblePosition: "Socio Gerente",
  address: "Martín Güemes 944",
  locality: "Rivadavia",
  province: "San Juan",
  country: "Argentina",
  postalCode: null,
  email: "sanjuanconexionsj@gmail.com",
  phone: "264-6210237",
  taxId: "20290454493",
  grossIncomeNumber: "20290454493",
  rupeNumber: "80547",
} as const;

type CompanySettingsRecord = {
  id: number;
  commercialName: string | null;
  legalName: string | null;
  logoUrl: string | null;
  logoPath: string | null;
  signatureUrl: string | null;
  signaturePath: string | null;
  responsibleName: string | null;
  responsiblePosition: string | null;
  address: string | null;
  locality: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  grossIncomeNumber: string | null;
  rupeNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number | null;
};

function serializeCompanySettings(settings: CompanySettingsRecord) {
  return {
    id: settings.id,
    commercialName: settings.commercialName,
    legalName: settings.legalName,
    logoUrl: settings.logoUrl,
    logoPath: settings.logoPath,
    signatureUrl: settings.signatureUrl,
    signaturePath: settings.signaturePath,
    responsibleName: settings.responsibleName,
    responsiblePosition: settings.responsiblePosition,
    address: settings.address,
    locality: settings.locality,
    province: settings.province,
    country: settings.country,
    postalCode: settings.postalCode,
    email: settings.email,
    phone: settings.phone,
    taxId: settings.taxId,
    grossIncomeNumber: settings.grossIncomeNumber,
    rupeNumber: settings.rupeNumber,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
    updatedBy: settings.updatedBy,
  };
}

async function ensureCompanySettings() {
  return prisma.companySettings.upsert({
    where: { id: COMPANY_SETTINGS_ID },
    update: {},
    create: INITIAL_COMPANY_SETTINGS,
  });
}

async function writeAuditLog(
  userId: number | undefined,
  action: string,
  details?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      resource: "company_settings",
      details,
    },
  });
}

export async function getCompanySettings() {
  const settings = await ensureCompanySettings();
  return serializeCompanySettings(settings);
}

export async function updateCompanySettings(
  input: UpdateCompanySettingsInput,
  userId?: number,
) {
  await ensureCompanySettings();
  const data = {
    ...normalizeCompanySettingsInput(input),
    updatedBy: userId ?? null,
  };

  const settings = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data,
  });

  await writeAuditLog(userId, "company_settings.update", {
    updatedFields: Object.keys(input),
  });

  return serializeCompanySettings(settings);
}

export async function updateCompanyLogo(
  logo: { logoUrl: string; logoPath: string | null },
  userId?: number,
) {
  await ensureCompanySettings();
  const settings = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data: {
      logoUrl: logo.logoUrl,
      logoPath: logo.logoPath,
      updatedBy: userId ?? null,
    },
  });

  await writeAuditLog(userId, "company_settings.logo.update", {
    logoUrl: logo.logoUrl,
  });

  return serializeCompanySettings(settings);
}

export async function clearCompanyLogo(userId?: number) {
  await ensureCompanySettings();
  const settings = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data: {
      logoUrl: null,
      logoPath: null,
      updatedBy: userId ?? null,
    },
  });

  await writeAuditLog(userId, "company_settings.logo.delete");

  return serializeCompanySettings(settings);
}

export async function updateCompanySignature(
  signature: { signatureUrl: string; signaturePath: string | null },
  userId?: number,
) {
  await ensureCompanySettings();
  const settings = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data: {
      signatureUrl: signature.signatureUrl,
      signaturePath: signature.signaturePath,
      updatedBy: userId ?? null,
    },
  });

  await writeAuditLog(userId, "company_settings.signature.update", {
    signatureUrl: signature.signatureUrl,
  });

  return serializeCompanySettings(settings);
}

export async function clearCompanySignature(userId?: number) {
  await ensureCompanySettings();
  const settings = await prisma.companySettings.update({
    where: { id: COMPANY_SETTINGS_ID },
    data: {
      signatureUrl: null,
      signaturePath: null,
      updatedBy: userId ?? null,
    },
  });

  await writeAuditLog(userId, "company_settings.signature.delete");

  return serializeCompanySettings(settings);
}
