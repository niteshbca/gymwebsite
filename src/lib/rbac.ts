/**
 * Role-based access control. Permissions are enforced on EVERY protected API
 * route, not only in the UI. Roles carry a default permission set; users may
 * hold additional granular permissions.
 */

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  GYM_OWNER: "gym_owner",
  BRANCH_MANAGER: "branch_manager",
  RECEPTIONIST: "receptionist",
  TRAINER: "trainer",
  ACCOUNTANT: "accountant",
  MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

const READ: string[] = [];
const W = (r: string) => `${r}:read`;

const perms = {
  dashboard: ["dashboard:read"],
  members: ["members:read", "members:create", "members:update", "members:delete", "members:export", "members:import"],
  plans: ["plans:read", "plans:create", "plans:update", "plans:delete"],
  subscriptions: [
    "subscriptions:read",
    "subscriptions:create",
    "subscriptions:update",
    "subscriptions:cancel",
    "subscriptions:refund",
  ],
  payments: ["payments:read", "payments:create", "payments:refund", "payments:approve", "payments:export"],
  attendance: ["attendance:read", "attendance:checkin", "attendance:export"],
  trainers: ["trainers:read", "trainers:create", "trainers:update", "trainers:delete"],
  workouts: ["workouts:read", "workouts:create", "workouts:update", "workouts:delete"],
  classes: ["classes:read", "classes:create", "classes:update", "classes:delete", "classes:book"],
  leads: ["leads:read", "leads:create", "leads:update", "leads:delete", "leads:convert"],
  expenses: ["expenses:read", "expenses:create", "expenses:update", "expenses:delete", "expenses:approve"],
  inventory: ["inventory:read", "inventory:create", "inventory:update", "inventory:delete"],
  equipment: ["equipment:read", "equipment:create", "equipment:update", "equipment:delete"],
  reports: ["reports:read", "reports:export"],
  settings: ["settings:read", "settings:update"],
  users: ["users:read", "users:create", "users:update", "users:disable"],
  branches: ["branches:read", "branches:create", "branches:update"],
  audit: ["audit:read"],
  notifications: ["notifications:read", "notifications:send", "notifications:manage"],
};

export type Permission = (typeof perms)[keyof typeof perms][number];
export const ALL_PERMISSIONS: Permission[] = Object.values(perms).flat();

function allOf(...groups: (keyof typeof perms)[]): Permission[] {
  return groups.flatMap((g) => perms[g]);
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [ROLES.GYM_OWNER]: allOf(
    "dashboard", "members", "plans", "subscriptions", "payments", "attendance",
    "trainers", "workouts", "classes", "leads", "expenses", "inventory", "equipment",
    "reports", "settings", "users", "branches", "audit", "notifications",
  ),
  [ROLES.BRANCH_MANAGER]: allOf(
    "dashboard", "members", "plans", "subscriptions", "payments", "attendance",
    "trainers", "workouts", "classes", "leads", "expenses", "inventory", "equipment",
    "reports", "notifications",
  ),
  [ROLES.RECEPTIONIST]: allOf("dashboard", "members", "subscriptions", "payments", "attendance", "classes", "leads"),
  [ROLES.TRAINER]: allOf("dashboard", "attendance").concat(
    "members:read", "classes:read", "workouts:read", "workouts:create", "workouts:update",
  ),
  [ROLES.ACCOUNTANT]: allOf("dashboard", "payments", "expenses", "reports", "subscriptions"),
  [ROLES.MEMBER]: [],
};

export const STAFF_ROLES: Role[] = [
  ROLES.SUPER_ADMIN, ROLES.GYM_OWNER, ROLES.BRANCH_MANAGER,
  ROLES.RECEPTIONIST, ROLES.TRAINER, ROLES.ACCOUNTANT,
];

export function effectivePermissions(role: Role, extra: string[] = []): Set<string> {
  return new Set<string>([...(ROLE_PERMISSIONS[role] ?? []), ...extra]);
}

export function can(role: Role, permission: string, extra: string[] = []): boolean {
  return effectivePermissions(role, extra).has(permission);
}

/** Roles that can access data of any branch. */
export function isSuperScoped(role: Role): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.GYM_OWNER;
}

/**
 * Returns a MongoDB filter fragment restricting results to the actor's branch.
 * Super-scope roles see all branches.
 */
export function branchScope(role: Role, branchId: string | null | undefined): Record<string, unknown> {
  if (isSuperScoped(role)) return {};
  if (!branchId) return { _id: null }; // branch-bound role without branch => no data
  return { branch: branchId };
}

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.GYM_OWNER]: "Gym Owner",
  [ROLES.BRANCH_MANAGER]: "Branch Manager",
  [ROLES.RECEPTIONIST]: "Receptionist",
  [ROLES.TRAINER]: "Trainer",
  [ROLES.ACCOUNTANT]: "Accountant",
  [ROLES.MEMBER]: "Member",
};

void READ; void W;
