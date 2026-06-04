import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { UserForm } from "@/app/Components/users/UserForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditUserPage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Users & Roles", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="users" action="edit" />;
    }
    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [uRows] = await dbTenant(`
        SELECT u.id, u.name, u.email, u.phone, u.roleId, u.status, u.avatarUrl,
               r.id as role_id, r.name as role_name, r.isSystem as role_isSystem
        FROM \`users\` u
        LEFT JOIN \`roles\` r ON r.id = u.roleId
        WHERE u.id = ? LIMIT 1
    `, [id]);
    if (!uRows || uRows.length === 0) {
        notFound();
    }
    const row = uRows[0];
    const user = {
        id: row.id, name: row.name, email: row.email, phone: row.phone,
        roleId: row.roleId, status: row.status, avatarUrl: row.avatarUrl,
        role: row.roleId ? { id: row.role_id, name: row.role_name, isSystem: !!row.role_isSystem } : null,
    };
    if (!user) {
        notFound();
    }
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title={`Edit User: ${user.name}`} description="Update user details and role."/>
            <UserForm initialData={user}/>
        </div>);
}
