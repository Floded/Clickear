import { prisma } from "../../prisma/client.js";
import { normalizeCompanySettingsInput } from "./company-settings.dto.js";
const COMPANY_SETTINGS_ID = 1;
const INITIAL_COMPANY_SETTINGS = {
    id: COMPANY_SETTINGS_ID,
    commercialName: null,
    legalName: null,
    logoUrl: null,
    logoPath: null,
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
};
function serializeCompanySettings(settings) {
    return {
        id: settings.id,
        commercialName: settings.commercialName,
        legalName: settings.legalName,
        logoUrl: settings.logoUrl,
        logoPath: settings.logoPath,
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
async function writeAuditLog(userId, action, details) {
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
export async function updateCompanySettings(input, userId) {
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
export async function updateCompanyLogo(logo, userId) {
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
export async function clearCompanyLogo(userId) {
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
//# sourceMappingURL=company-settings.service.js.map