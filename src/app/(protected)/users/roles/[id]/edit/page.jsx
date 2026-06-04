import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { RoleForm } from "@/app/Components/roles/RoleForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditRolePage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Users & Roles", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="roles" action="edit" />;
    }
    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [rRows] = await dbTenant(`SELECT * FROM \`roles\` WHERE id = ? LIMIT 1`, [id]);
    if (!rRows || rRows.length === 0) {
        notFound();
    }
    const [perms] = await dbTenant(`SELECT rp.id, rp.roleId, rp.permissionId FROM \`role_permissions\` rp WHERE rp.roleId = ?`, [id]);
    const role = { ...rRows[0], permissions: perms || [] };
    if (!role) {
        notFound();
    }
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title={`Edit Role: ${role.name}`} description="Manage role details and permissions."/>
            <RoleForm initialData={role}/>
        </div>);
}
