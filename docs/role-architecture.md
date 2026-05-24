# MAJH OS Role Architecture

Status: Authoritative as of May 22, 2026
Authority: Founder decision, role-system design session
Supersedes: Implicit role assumptions in legacy code

## Purpose

This document defines the canonical role hierarchy for MAJH OS. Every authorization
decision in the platform should ultimately reduce to a check against this hierarchy.

The architecture is multi-tenant, multi-department, multi-location, and supports
users holding different roles in different scopes simultaneously. A user may be a
PLATFORM_OWNER, a TENANT_OWNER of one tenant, a TENANT_MEMBER of another tenant,
and a DEPARTMENT_MANAGER within a specific tenant + department — all at the same time.

## Layered scope model

Roles exist at five layersj. Each layer corresponds to a different storage location
and a different scope:

| Layer | Storage | Scope |
|-------|---------|-------|
| Platform | profiles.role | The entire MAJH OS platform. Crosses tenants. |
| Tenant | organization_members (department_id=NULL, location_id=NULL) | One tenant. |
| Department | organization_members (department_id SET, location_id=NULL) | One department within one tenant. |
| Location | organization_members (location_id SET) | One location. |
| Event/Broadcast | Per-event role tables (future, e.g. organization_broadcast_roles) | One specific event or broadcast. |

A user's effective permissions are the UNION of all permissions granted by ALL roles
they hold across all five layers, filtered by the current scope of the operation
being performed.

## Platform layer roles (profiles.role)

Stored in profiles.role (legacy column). Values are lowercase to match existing
code recognition until T-204 migration completes.

| Role Key | Description | Notes |
|----------|-------------|-------|
| OWNER | Platform founder. Total authority across all tenants, departments, locations. Can transfer ownership of platform. | Founder only |
| SUPER_ADMIN | Operates the platform on behalf of the owner. Can act across tenants for support and debugging. Cannot transfer ownership or modify owner's account. | Reserved. Unassigned. |
| USER | Default authenticated user. No platform-level authority. Authority comes only from tenant/department/location/event-level rows. | Default for all signups |

Legacy bridge values (current codebase consumption):

| New role key | Legacy profiles.role value | Reason |
|--------------|------------------------------|--------|
| OWNER | owner | Already in use |
| SUPER_ADMIN | admin | Recognized by requireRole(); gives admin-page access |
| USER | user | Already in use |

After T-204 ships, the legacy column is deprecated and roles are read from the
authoritative tables only.

## Tenant layer roles (organization_members, department_id=NULL)

Stored in organization_members with tenant_id SET, department_id NULL,
location_id NULL. A user may have rows in multiple tenants.

| Role Key | Description |
|----------|-------------|
| TENANT_OWNER | Owns the tenant. Total authority within tenant. |
| TENANT_SUPER_ADMIN | Tenant-wide authority above all department admins. Executive-level position. Reserved for senior operators. |
| TENANT_ADMIN | Admin within a tenant. Typically paired with department-level admin assignments. Cannot override TENANT_SUPER_ADMIN decisions. |
| TENANT_MANAGER | Manages tenant operations (staff, configs, day-to-day decisions). |
| TENANT_BILLING | Financial access only. Billing, payouts, financial reports. For accountants and finance staff. |
| TENANT_MEMBER | Basic membership. Read access to tenant content. |

## Department layer roles (organization_members, department_id SET)

Stored in organization_members with tenant_id SET, department_id SET. Allows
fine-grained per-department staff assignment.

| Role Key | Description |
|----------|-------------|
| DEPARTMENT_ADMIN | Full admin within one specific department of one tenant (e.g., CarBadMV admin, T.R.S. admin, MAJH Esports admin). |
| DEPARTMENT_MANAGER | Day-to-day department operations. |
| DEPARTMENT_STAFF | Department-level staff. Operational access. |

## Location layer roles (organization_members, location_id SET)

For franchise-style operations where a location manager controls one specific site.

| Role Key | Description |
|----------|-------------|
| LOCATION_MANAGER | Runs the location. Manages local staff schedules, inventory, on-site operations. |
| LOCATION_STAFF | Works at the location. |

## Event/Broadcast layer roles (future, scoped per event)

These will live in per-event role tables (e.g. organization_broadcast_roles from
the MAJH Studio architecture). Created on-demand by tenant/department admins for
specific events.

| Role Key | Description |
|----------|-------------|
| ORGANIZER | Runs a specific tournament. |
| REFEREE | Verifies match results, settles disputes. |
| MODERATOR | Moderates chat and behavior. |
| COMMENTATOR | Provides commentary. |
| BROADCAST_ADMIN | Full control of a broadcast. |
| BROADCAST_PRODUCER | Operational control during broadcast. |
| BROADCAST_COMMENTATOR | Audio commentary access. |
| BROADCAST_MODERATOR | Chat moderation during broadcast. |

## User-level community roles

Self-assigned or community-assigned, not authorization-bearing. Describe how a user
participates in content.

| Role Key | Description |
|----------|-------------|
| PLAYER | Competes in tournaments. |
| STREAMER | Broadcasts their own content. |
| VIEWER | Watches content. |

## Permission categories

Permissions are namespaced. Each permission is a string of the form category.action
or category.object.action. Sensitive permissions (financial, destructive, audit)
are flagged with is_sensitive=true.

| Category | Examples |
|----------|----------|
| platform.* | platform.settings.edit, platform.tenant.create, platform.audit.read |
| tenant.* | tenant.settings.edit, tenant.staff.grant, tenant.staff.revoke |
| department.* | department.settings.edit, department.staff.manage, department.inventory.manage |
| location.* | location.settings.edit, location.staff.manage |
| finance.* | finance.read, finance.payout.initiate, finance.dispute.resolve |
| tournament.* | tournament.create, tournament.manage_own, tournament.manage_any, tournament.organize |
| broadcast.* | broadcast.create, broadcast.go_live, broadcast.moderate |
| community.* | community.moderate, community.ban_user, community.delete_message |
| user.* | user.profile.edit, user.preferences.edit |

## Authorization decision algorithm (target state, after T-204)

```text
function userHasPermission(userId, permissionKey, scope):
# scope = { tenant_id?, department_id?, location_id?, event_id? }
# Collect all role assignments for this user
platformRole = profiles.role (legacy) OR derived from new model
tenantRoles = organization_members WHERE user_id = userId
eventRoles = per-event role tables WHERE user_id = userId

# Filter by scope
relevantRoles = filter(platformRole + tenantRoles + eventRoles, by scope)

# Union all permissions from all matching role templates
permissions = UNION(role_template_permissions WHERE role_key IN relevantRoles)

# Check
return permissionKey IN permissions
```

## Legacy code bridge (current state, pre-T-204)

The codebase currently has 144 authorization check points across three patterns:

1. requireRole() in lib/roles.ts (25 places) — checks staff_roles
2. Inline staff_roles queries (107 places) — checks staff_roles
3. profiles.role checks (12 places) — checks profiles.role

None of these consume organization_members. Until T-204 ships, founder users must
have rows in ALL THREE tables with matching legacy values.

The mapping for the legacy bridge:

| New role | profiles.role | staff_roles.role | organization_members.role_key |
|----------|---------------|------------------|-------------------------------|
| PLATFORM_OWNER | owner | owner | (none — platform-level) |
| TENANT_OWNER | owner | owner | TENANT_OWNER |
| TENANT_SUPER_ADMIN | admin | owner | TENANT_SUPER_ADMIN |
| TENANT_ADMIN | admin | manager | TENANT_ADMIN |
| TENANT_MANAGER | staff | manager | TENANT_MANAGER |
| TENANT_MEMBER | user | (none) | TENANT_MEMBER |

When T-204 migration completes, all 144 check points consume organization_members
and the legacy columns are deprecated.

## Decisions log

- 2026-05-22: Hierarchy approved by founder. SCREAMING_SNAKE_CASE adopted.
  TENANT_SUPER_ADMIN tier added to distinguish tenant-wide authority from
  department-wide authority. Existing 2 organization_members rows migrated
  from owner to TENANT_OWNER.
- 2026-05-22: Zach assigned TENANT_SUPER_ADMIN of MAJH Events tenant.
  Position offered as executive role — Zach to accept or decline based on
  scope of responsibility.

## Related migrations

- `supabase/migrations/20260522_011_seed_role_hierarchy.sql`

> Paste status: Mark referenced the migration path above on May 24, 2026, but
> has not pasted its SQL content yet. Do not fabricate the migration from this
> reference alone; use the actual file if present or wait for pasted content.
