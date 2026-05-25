import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("is_super_admin", {
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("רק סופר-אדמין רשאי לבצע פעולה זו");
}

const RoleEnum = z.enum(["super_admin", "admin", "viewer"]);
type DbRole = z.infer<typeof RoleEnum>;

// ----- Update existing user (role row)
const UpdateUserInput = z.object({
  roleId: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120).nullable().optional(),
  email: z.string().trim().email().max(254).optional(),
  role: RoleEnum.optional(),
  assignedBranchId: z.string().uuid().nullable().optional(),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateUserInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Patch user_roles
    const rolePatch: {
      email?: string;
      role?: DbRole;
      assigned_branch_id?: string | null;
    } = {};
    if (data.email) rolePatch.email = data.email.toLowerCase();
    if (data.role) rolePatch.role = data.role;
    if (data.assignedBranchId !== undefined)
      rolePatch.assigned_branch_id = data.assignedBranchId;

    if (Object.keys(rolePatch).length > 0) {
      // Enforce strictly ONE role per user: drop any other role rows for this user
      // before updating, so the UNIQUE (user_id, role) constraint can't collide
      // when switching a user's role from admin↔viewer.
      if (rolePatch.role) {
        const { error: eDel } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .neq("id", data.roleId);
        if (eDel) throw new Error(eDel.message);
      }

      const { error: e1 } = await supabaseAdmin
        .from("user_roles")
        .update(rolePatch)
        .eq("id", data.roleId);
      if (e1) throw new Error(e1.message);
    }

    // Patch profile name
    if (data.fullName !== undefined) {
      const { error: e2 } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName })
        .eq("user_id", data.userId);
      if (e2) throw new Error(e2.message);
    }

    // Patch auth email if changed
    if (data.email) {
      const { error: e3 } = await supabaseAdmin.auth.admin.updateUserById(
        data.userId,
        { email: data.email.toLowerCase(), email_confirm: true },
      );
      if (e3) throw new Error(e3.message);
    }

    return { ok: true };
  });

// ----- Suspend user (set inactive + global sign-out)
const SuspendInput = z.object({
  roleId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const adminSuspendUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuspendInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);

    // Block self-suspend
    if (data.userId === context.userId) {
      throw new Error("אינך יכול להשבית את חשבונך");
    }

    // Block suspending super admins
    const { data: isSuper } = await supabaseAdmin.rpc("is_super_admin", {
      _user_id: data.userId,
    });
    if (isSuper) throw new Error("לא ניתן להשבית סופר-אדמין");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ is_active: false })
      .eq("id", data.roleId);
    if (error) throw new Error(error.message);

    // Force global sign-out (kicks the user from every session)
    try {
      await supabaseAdmin.auth.admin.signOut(data.userId, "global");
    } catch {
      // ignore — RLS already prevents access
    }
    return { ok: true };
  });

// ----- Reactivate
const ReactivateInput = z.object({ roleId: z.string().uuid() });

export const adminReactivateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReactivateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ is_active: true })
      .eq("id", data.roleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Revoke invitation (hard delete)
const RevokeInviteInput = z.object({ invitationId: z.string().uuid() });

export const adminRevokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RevokeInviteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("id", data.invitationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Update invitation details
const UpdateInviteInput = z.object({
  invitationId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(120).nullable().optional(),
  email: z.string().trim().email().max(254).optional(),
  role: RoleEnum.optional(),
  assignedBranchId: z.string().uuid().nullable().optional(),
});

export const adminUpdateInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInviteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId);
    const patch: {
      full_name?: string | null;
      email?: string;
      role?: DbRole;
      assigned_branch_id?: string | null;
    } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.email) patch.email = data.email.toLowerCase();
    if (data.role) patch.role = data.role;
    if (data.assignedBranchId !== undefined)
      patch.assigned_branch_id = data.assignedBranchId;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin
      .from("invitations")
      .update(patch)
      .eq("id", data.invitationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
