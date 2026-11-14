import { Router } from "express";
import { BadRequestError } from "../../shared/http-error.js";
import { updateCompanySettingsSchema } from "./company-settings.dto.js";
import { clearCompanyLogo, getCompanySettings, updateCompanyLogo, updateCompanySettings, } from "./company-settings.service.js";
import { companyLogoUpload, handleLogoUploadError, removeCompanyLogoFromStorage, uploadCompanyLogoToStorage, } from "./company-settings.storage.js";
export const companySettingsRouter = Router();
companySettingsRouter.get("/", async (_req, res) => {
    res.json(await getCompanySettings());
});
companySettingsRouter.put("/", async (req, res) => {
    const input = updateCompanySettingsSchema.parse(req.body);
    res.json(await updateCompanySettings(input, req.user?.id));
});
companySettingsRouter.post("/logo", companyLogoUpload.single("logo"), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new BadRequestError("Debe adjuntar un archivo de logotipo en el campo 'logo'");
        }
        const current = await getCompanySettings();
        const uploaded = await uploadCompanyLogoToStorage(req.file);
        try {
            const updated = await updateCompanyLogo(uploaded, req.user?.id);
            if (current.logoPath && current.logoPath !== uploaded.logoPath) {
                await removeCompanyLogoFromStorage(current.logoPath);
            }
            res.json(updated);
        }
        catch (error) {
            // Si falla la persistencia en BD, evita dejar huérfano el archivo subido
            await removeCompanyLogoFromStorage(uploaded.logoPath).catch(() => undefined);
            throw error;
        }
    }
    catch (error) {
        next(error);
    }
}, handleLogoUploadError);
companySettingsRouter.delete("/logo", async (req, res, next) => {
    try {
        const current = await getCompanySettings();
        if (current.logoPath) {
            await removeCompanyLogoFromStorage(current.logoPath);
        }
        res.json(await clearCompanyLogo(req.user?.id));
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=company-settings.routes.js.map