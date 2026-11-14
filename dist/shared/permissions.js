export const FEATURES = ["tickets", "organization", "inventory", "budgets", "invoices"];
const ALL_EDIT_PERMISSIONS = FEATURES.map((feature) => ({
    feature,
    access: "EDIT",
}));
// El administrador tiene acceso total implícito; el resto usa sus permisos asignados
export function resolvePermissions(role, permissions) {
    return role === "ADMIN" ? ALL_EDIT_PERMISSIONS : permissions;
}
export function canView(role, permissions, feature) {
    if (role === "ADMIN")
        return true;
    return permissions.some((p) => p.feature === feature && (p.access === "VIEW" || p.access === "EDIT"));
}
export function canEdit(role, permissions, feature) {
    if (role === "ADMIN")
        return true;
    return permissions.some((p) => p.feature === feature && p.access === "EDIT");
}
//# sourceMappingURL=permissions.js.map