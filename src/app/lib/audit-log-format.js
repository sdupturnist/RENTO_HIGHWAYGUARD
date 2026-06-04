function toWords(value) {
    return String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function toTitleCase(value) {
    return toWords(value)
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAction(action) {
    const raw = String(action || "").trim();
    const autoLess = raw.startsWith("AUTO_") ? raw.slice(5) : raw;

    const actionMap = {
        CREATE: "Created",
        CREATEMANY: "Created",
        UPDATE: "Updated",
        UPDATEMANY: "Updated",
        DELETE: "Deleted",
        DELETEMANY: "Deleted",
        UPSERT: "Saved",
        PATCH: "Updated",
        STATUS_CHANGE: "Status Changed",
        LOCKED: "Locked",
        USER_UNLOCKED: "Unlocked",
        APPROVE: "Approved",
        UNAPPROVE: "Approval Removed",
        LOGIN_SUCCESS: "Logged In",
        LOGIN_FAILED: "Login Failed",
        LOGIN_FAILED_RATE_LIMIT: "Login Blocked (Too Many Attempts)",
        LOGIN_BLOCKED_LOCKED: "Login Blocked (Account Locked)",
        PASSWORD_RESET_REQUESTED: "Password Reset Requested",
        PASSWORD_RESET: "Password Reset",
        AUTO_COMPLETE: "Auto Completed",
        LOGOUT_SUCCESS: "Logged Out",
        // Master tenant actions
        TENANT_CREATED: "Tenant Created",
        TENANT_UPDATED: "Tenant Updated",
        TENANT_ENABLED: "Tenant Enabled",
        TENANT_DISABLED: "Tenant Disabled",
        TENANT_BACKUP_TRIGGERED: "Backup Started",
        TENANT_RESTORE_TRIGGERED: "Restore Started",
        TENANT_RESTORE_COMPLETED: "Restore Completed",
        TENANT_DELETE_PREPARE: "Tenant Delete Prepared",
        TENANT_DELETED_HARD: "Tenant Permanently Deleted",
        CREATE_TENANT: "Tenant Created",
        UPDATE_TENANT: "Tenant Updated",
        HARD_DELETE_CLIENT: "Tenant Permanently Deleted",
        BACKUP_TENANT: "Tenant Backed Up",
        RESTORE_TENANT: "Tenant Restored",
        // Master user actions
        CM_USER_CREATED: "Master User Created",
        CM_USER_UPDATED: "Master User Updated",
        CM_USER_DELETED: "Master User Deleted",
        CM_USER_PASSWORD_RESET: "Master User Password Reset",
        CM_USER_PASSWORD_RESET_REQUESTED: "Master User Password Reset Requested",
        // Master settings actions
        MASTER_BRANDING_UPDATED: "Master Branding Updated",
        MASTER_SMTP_UPDATED: "Email Settings Updated",
        MASTER_SMTP_TEST_SUCCESS: "Email Test Sent Successfully",
        MASTER_SMTP_TEST_FAILED: "Email Test Failed",
        MASTER_CRON_UPDATED: "Scheduler Settings Updated",
        MASTER_BACKUP_STARTED: "Master Backup Started",
        MASTER_BACKUP_DUMP: "Database Backup Dumped",
        MASTER_RESTORE_STARTED: "Master Restore Started",
        MASTER_BACKUP_RESTORED: "Master Backup Restored",
        // Cron actions
        CRON_STARTED: "Scheduler Started",
        CRON_FINISHED: "Scheduler Finished",
        CRON_FAILED: "Scheduler Failed",
    };

    return actionMap[autoLess] || toTitleCase(autoLess);
}

function normalizeEntity(entityType) {
    const raw = String(entityType || "").trim();
    const entityMap = {
        ROLEPERMISSION: "Role Permissions",
        DAILYTIMELOG: "Daily Time Logs",
        CMUSER: "Master User",
        SETTINGS: "Settings",
        AUTH: "Sign In",
        USER: "User",
        ROLE: "Role",
        PROJECT: "Project",
        CUSTOMER: "Customer",
        OPERATOR: "Operator",
        VEHICLE: "Vehicle",
        ASSIGNMENT: "Assignment",
        INVOICE: "Invoice",
        MAINTENANCE: "Maintenance",
        TIMESHEET: "Timesheet",
        EXPENSE: "Expense",
        TENANT: "Tenant",
        PLAN: "System Plan",
        CRON: "Scheduler",
        EMAIL: "Email Settings",
        BRANDING: "Branding",
        BACKUP: "Backup",
    };

    return entityMap[raw.toUpperCase()] || toTitleCase(raw);

}

function buildEntityLabel(entityType, entityId) {
    const entity = normalizeEntity(entityType);
    return Number(entityId) > 0 ? `${entity} #${entityId}` : entity;
}

function simplifyAutoDescription(description, entityType, action, entityId) {
    const raw = String(description || "").trim();
    if (!raw) return "";

    const normalizedAction = String(action || "").trim();
    const isAuto = normalizedAction.startsWith("AUTO_");
    if (!isAuto) return raw;

    const readableAction = normalizeAction(normalizedAction);
    const entityLabel = normalizeEntity(entityType);
    const hasMany = normalizedAction.includes("MANY");
    const lowerEntity = entityLabel.toLowerCase();

    if (readableAction === "Created") {
        return hasMany
            ? `The system created ${lowerEntity}.`
            : `The system created ${lowerEntity}${Number(entityId) > 0 ? ` #${entityId}` : ""}.`;
    }

    if (readableAction === "Updated") {
        return hasMany
            ? `The system updated ${lowerEntity}.`
            : `The system updated ${lowerEntity}${Number(entityId) > 0 ? ` #${entityId}` : ""}.`;
    }

    if (readableAction === "Deleted") {
        return hasMany
            ? `The system deleted ${lowerEntity}.`
            : `The system deleted ${lowerEntity}${Number(entityId) > 0 ? ` #${entityId}` : ""}.`;
    }

    if (readableAction === "Saved") {
        return `The system saved ${lowerEntity}${Number(entityId) > 0 ? ` #${entityId}` : ""}.`;
    }

    return `The system recorded an action for ${lowerEntity}${Number(entityId) > 0 && !hasMany ? ` #${entityId}` : ""}.`;
}

function simplifyManualDescription(description, entityType, action, entityId) {
    const raw = String(description || "").trim();
    if (!raw) return "";

    if (raw.startsWith("{") || raw.startsWith("[")) {
        return `A ${normalizeAction(action).toLowerCase()} action was recorded for ${normalizeEntity(entityType).toLowerCase()}${Number(entityId) > 0 ? ` #${entityId}` : ""}.`;
    }

    return raw
        .replace(/\s+/g, " ")
        .replace(/^Created\b/i, "Created")
        .replace(/^Updated\b/i, "Updated")
        .replace(/^Deleted\b/i, "Deleted");
}

export function formatAuditLog(log) {
    const displayAction = normalizeAction(log.action);
    const displayEntity = buildEntityLabel(log.entityType, log.entityId);
    const displayDescription =
        simplifyAutoDescription(log.description, log.entityType, log.action, log.entityId) ||
        simplifyManualDescription(log.description, log.entityType, log.action, log.entityId) ||
        "An activity was recorded.";

    return {
        ...log,
        displayAction,
        displayEntity,
        displayDescription,
    };
}
