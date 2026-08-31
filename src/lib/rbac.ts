import { prisma } from "./prisma";
import { TokenPayload } from "./auth";
import { Prisma } from "@prisma/client";

export type UserRole = "ADMIN" | "MANAGER" | "RECOVERY_OFFICER";

export const PERMISSIONS = {
  // User permissions
  USERS_READ_ALL: "users:read:all",
  USERS_READ_TEAM: "users:read:team",
  USERS_CREATE_ADMIN: "users:create:admin",
  USERS_CREATE_MANAGER: "users:create:manager",
  USERS_CREATE_OFFICER: "users:create:officer",
  USERS_UPDATE_ALL: "users:update:all",
  USERS_UPDATE_TEAM: "users:update:team",
  USERS_DELETE_ALL: "users:delete:all",
  USERS_STATUS_ALL: "users:status:all",
  USERS_STATUS_TEAM: "users:status:team",

  // Customer permissions
  CUSTOMERS_READ_ALL: "customers:read:all",
  CUSTOMERS_READ_TEAM: "customers:read:team",
  CUSTOMERS_READ_ASSIGNED: "customers:read:assigned",
  CUSTOMERS_ASSIGN_ALL: "customers:assign:all",
  CUSTOMERS_ASSIGN_TEAM: "customers:assign:team",
  CUSTOMERS_UPDATE_ALL: "customers:update:all",
  CUSTOMERS_UPDATE_ASSIGNED: "customers:update:assigned",

  // Recovery & Installment permissions
  INSTALLMENTS_READ_ALL: "installments:read:all",
  INSTALLMENTS_READ_TEAM: "installments:read:team",
  INSTALLMENTS_READ_ASSIGNED: "installments:read:assigned",
  RECOVERY_RECORD_PAYMENT: "recovery:record:payment",

  // WhatsApp permissions
  WHATSAPP_SEND_ALL: "whatsapp:send:all",
  WHATSAPP_SEND_TEAM: "whatsapp:send:team",
  WHATSAPP_SEND_ASSIGNED: "whatsapp:send:assigned",

  // Reports & Audit
  REPORTS_ALL: "reports:all",
  REPORTS_TEAM: "reports:team",
  REPORTS_SELF: "reports:self",
  AUDIT_READ_ALL: "audit:read:all",
  AUDIT_READ_TEAM: "audit:read:team",
  AUDIT_READ_SELF: "audit:read:self",

  // System Settings
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.USERS_READ_TEAM,
    PERMISSIONS.USERS_CREATE_OFFICER,
    PERMISSIONS.USERS_UPDATE_TEAM,
    PERMISSIONS.USERS_STATUS_TEAM,
    PERMISSIONS.CUSTOMERS_READ_TEAM,
    PERMISSIONS.CUSTOMERS_ASSIGN_TEAM,
    PERMISSIONS.CUSTOMERS_UPDATE_ALL,
    PERMISSIONS.INSTALLMENTS_READ_TEAM,
    PERMISSIONS.RECOVERY_RECORD_PAYMENT,
    PERMISSIONS.WHATSAPP_SEND_TEAM,
    PERMISSIONS.REPORTS_TEAM,
    PERMISSIONS.AUDIT_READ_TEAM,
  ],
  RECOVERY_OFFICER: [
    PERMISSIONS.CUSTOMERS_READ_ASSIGNED,
    PERMISSIONS.CUSTOMERS_UPDATE_ASSIGNED,
    PERMISSIONS.INSTALLMENTS_READ_ASSIGNED,
    PERMISSIONS.RECOVERY_RECORD_PAYMENT,
    PERMISSIONS.WHATSAPP_SEND_ASSIGNED,
    PERMISSIONS.REPORTS_SELF,
    PERMISSIONS.AUDIT_READ_SELF,
  ],
};

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role as UserRole] || [];
  return perms.includes(permission);
}

/**
 * Returns Prisma query 'where' clause that scopes customer queries strictly by role
 */
export function getUserCustomerScope(user: TokenPayload): Prisma.CustomerWhereInput {
  if (user.role === "ADMIN") {
    return {}; // Full global scope
  }

  if (user.role === "MANAGER") {
    return {
      OR: [
        { assignedManagerId: user.userId },
        { assignedTo: { managerId: user.userId } },
        { assignedToUserId: user.userId },
      ],
    };
  }

  if (user.role === "RECOVERY_OFFICER") {
    return {
      assignedToUserId: user.userId,
    };
  }

  // Fallback: zero access
  return { id: "never_match" };
}

/**
 * Validates if the authenticated user has authorization to view/edit a specific customer record
 */
export async function canAccessCustomer(user: TokenPayload, customerId: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;

  const scope = getUserCustomerScope(user);
  const exists = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...scope,
    },
    select: { id: true },
  });

  return !!exists;
}

/**
 * Validates if an actor can create, edit, activate/deactivate, or reset password of target user
 */
export async function canManageUser(actor: TokenPayload, targetUserId: string): Promise<boolean> {
  if (actor.role === "ADMIN") return true;

  if (actor.role === "MANAGER") {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, managerId: true },
    });

    if (!targetUser) return false;
    // Manager can only manage Recovery Officers in their own team
    return targetUser.role === "RECOVERY_OFFICER" && targetUser.managerId === actor.userId;
  }

  // Recovery Officers cannot manage any users
  return false;
}

/**
 * Validates if an actor can assign a customer to a target user
 */
export async function canAssignCustomer(
  actor: TokenPayload,
  customerId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (actor.role === "RECOVERY_OFFICER") {
    return { allowed: false, reason: "Recovery Officers cannot assign customers" };
  }

  // Verify target user exists and is active
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, managerId: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) {
    return { allowed: false, reason: "Target user is invalid or inactive" };
  }

  if (actor.role === "ADMIN") {
    return { allowed: true };
  }

  if (actor.role === "MANAGER") {
    // 1. Manager must have access to this customer
    const hasCustomerAccess = await canAccessCustomer(actor, customerId);
    if (!hasCustomerAccess) {
      return { allowed: false, reason: "You do not have permission to access this customer" };
    }

    // 2. Manager can only assign to officers in their own team or to themselves
    const isTeamMember =
      targetUser.id === actor.userId ||
      (targetUser.role === "RECOVERY_OFFICER" && targetUser.managerId === actor.userId);

    if (!isTeamMember) {
      return { allowed: false, reason: "You can only assign customers to Recovery Officers in your team" };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: "Unauthorized" };
}
