import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { Button } from "@/app/Components/ui/button";
import { Badge } from "@/app/Components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Edit, ArrowLeft, User } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { CustomerStatusActions } from "@/app/Components/customers/CustomerStatusActions";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { OverviewPage, OverviewSection, SectionGrid, InfoGrid, InfoField, FileList } from "@/app/Components/common/Overview";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function CustomerPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Customers", "View") : false;
    if (!canView) {
        return <Forbidden module="customers" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Customers", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Customers", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id))
        notFound();
    const [cRows] = await dbTenant(`SELECT * FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
    if (!cRows || cRows.length === 0) notFound();
    
    const [contacts] = await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId = ?`, [id]);
    const [documents] = await dbTenant(`SELECT * FROM \`customer_documents\` WHERE customerId = ?`, [id]);
    const [projects] = await dbTenant(`SELECT * FROM \`projects\` WHERE customerId = ?`, [id]);
    const [assignments] = await dbTenant(`SELECT * FROM \`assignments\` WHERE customerId = ?`, [id]);
    const [invoices] = await dbTenant(`SELECT * FROM \`invoices\` WHERE customerId = ?`, [id]);

    const customer = {
        ...cRows[0],
        contacts: contacts || [],
        documents: documents || [],
        projects: projects || [],
        assignments: assignments || [],
        invoices: invoices || [],
    };
    if (!customer)
        notFound();
    return (<OverviewPage title={<div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/customers">
                            <ArrowLeft className="h-4 w-4"/>
                        </Link>
                    </Button>
                    <span>{customer.companyName}</span>
                    <Badge variant={customer.status === "ACTIVE" ? "default" : "destructive"} className={customer.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
                        {customer.status}
                    </Badge>
                </div>} description={`${customer.customerCode} • Joined ${format(new Date(customer.createdAt), "MMM d, yyyy")}`} actions={<>
                    {canEdit && <CustomerStatusActions customerId={customer.id} currentStatus={customer.status}/>}
                    {canEdit && (
                        <Button variant="outline" asChild>
                            <Link href={`/customers/${customer.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4"/> Edit
                            </Link>
                        </Button>
                    )}
                    {canDelete && <DeleteButton apiPath={`/api/customers/${customer.id}`} queryKey="customers" redirectTo="/customers" entityLabel="Customer" />}
                </>}>

            <Tabs defaultValue="overview" className="space-y-4">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                    <TabsList>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="contacts">Contacts</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="documents">Documents</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="projects">Projects</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-4">
                    <SectionGrid>
                        <OverviewSection title="Customer Stats">
                            <div className="grid grid-cols-2 gap-3">
                                <InfoField label="Total Projects" value={customer.projects.length}/>
                                <InfoField label="Active Assignments" value={customer.assignments.length}/>
                            </div>
                        </OverviewSection>

                        <OverviewSection title="Company Details" className="md:col-span-2 lg:col-span-3">
                            <InfoGrid cols={2}>
                                <InfoField label="Address" value={customer.address || "N/A"}/>
                                <InfoField label="Email" value={customer.email || "N/A"}/>
                                <InfoField label="Phone" value={customer.phone || "N/A"}/>
                                <InfoField label="Website" value={customer.website || "N/A"}/>
                            </InfoGrid>
                        </OverviewSection>
                    </SectionGrid>
                </TabsContent>

                <TabsContent value="contacts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Persons</CardTitle>
                            <CardDescription>People associated with this company.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Designation</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Primary</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.contacts.length === 0 ? (<TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                No existing contacts found.
                                            </TableCell>
                                        </TableRow>) : (customer.contacts.map((contact) => (<TableRow key={contact.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground"/>
                                                        {contact.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{contact.designation || "-"}</TableCell>
                                                <TableCell>{contact.email || "-"}</TableCell>
                                                <TableCell>{contact.phone || "-"}</TableCell>
                                                <TableCell>
                                                    {contact.isPrimary && (<Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                                                            Primary
                                                        </Badge>)}
                                                </TableCell>
                                            </TableRow>)))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents">
                    <OverviewSection title="Documents" description="Attached documents for this customer.">
                        <FileList files={customer.documents || []}/>
                    </OverviewSection>
                </TabsContent>

                <TabsContent value="projects">
                    <OverviewSection title="Projects" description="Projects associated with this customer.">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Created At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customer.projects.length === 0 ? (<TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            No projects found.
                                        </TableCell>
                                    </TableRow>) : (customer.projects.map((project) => (<TableRow key={project.id}>
                                            <TableCell className="font-medium">{project.name}</TableCell>
                                            <TableCell>{project.location || "-"}</TableCell>
                                            <TableCell>{format(new Date(project.createdAt), "MMM d, yyyy")}</TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </OverviewSection>
                </TabsContent>

                <TabsContent value="activity">
                    <OverviewSection title="Activity Log">
                        <ActivityLogList entityType="CUSTOMER" entityId={customer.id}/>
                    </OverviewSection>
                </TabsContent>
            </Tabs>
        </OverviewPage>);
}
