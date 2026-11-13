export const FEATURES = ["tickets", "organization", "inventory", "budgets", "invoices"] as const;

export type FeatureKey = (typeof FEATURES)[number];
export type AccessMode = "VIEW" | "EDIT";

export interface UserPermission {
  feature: FeatureKey;
  access: AccessMode;
}

const ALL_EDIT_PERMISSIONS: UserPermission[] = FEATURES.map((feature) => ({
  feature,
  access: "EDIT",
}));

// El administrador tiene acceso total implícito; el resto usa sus permisos asignados
export function resolvePermissions(
  role: string,
  permissions: UserPermission[],
): UserPermission[] {
  return role === "ADMIN" ? ALL_EDIT_PERMISSIONS : permissions;
}

export function canView(
  role: string,
  permissions: UserPermission[],
  feature: FeatureKey,
): boolean {
  if (role === "ADMIN") return true;
  return permissions.some(
    (p) => p.feature === feature && (p.access === "VIEW" || p.access === "EDIT"),
  );
}

export function canEdit(
  role: string,
  permissions: UserPermission[],
  feature: FeatureKey,
): boolean {
  if (role === "ADMIN") return true;
  return permissions.some((p) => p.feature === feature && p.access === "EDIT");
}
