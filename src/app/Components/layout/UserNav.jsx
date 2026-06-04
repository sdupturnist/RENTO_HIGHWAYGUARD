"use client";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/Components/ui/avatar";
import { Button } from "@/app/Components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/app/Components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
import { useAppStore } from "@/app/lib/store/useAppStore";

export function UserNav() {
    const router = useRouter();
    const { profile: user, isLoading: loading } = useAppStore();
    const [showLogoutDialog, setShowLogoutDialog] = useState(false);
    const [avatarSrc, setAvatarSrc] = useState("");

    useEffect(() => {
        if (user) {
            setAvatarSrc(user?.avatarUrl || "");
        }
    }, [user]);

    useEffect(() => {
        const handleProfileUpdate = (e) => {
            setAvatarSrc(e.detail?.avatarUrl || "");
        };
        window.addEventListener("user-profile-updated", handleProfileUpdate);
        return () => window.removeEventListener("user-profile-updated", handleProfileUpdate);
    }, []);
    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            toast.success("Logged out successfully");
            window.location.href = "/login";
        }
        catch (error) {
            console.error("Logout failed", error);
            toast.error("Logout failed");
        }
    };
    const initials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .substring(0, 2)
        : "U";
    if (loading)
        return <div className="p-4 text-sm text-slate-500">Loading...</div>;
    return (<div className="flex items-center gap-1 md:gap-3">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-12 w-auto justify-start gap-3 px-2 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                    <Avatar className="h-9 w-9 border border-indigo-100 dark:border-indigo-900">
                        <AvatarImage src={avatarSrc} alt={user?.name} className="object-cover" onError={() => setAvatarSrc("")} />
                        <AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-left">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name || "User"}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.role?.name || "Guest"}</p>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 rounded-2xl p-0 shadow-2xl border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl" align="end">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white dark:border-slate-700 shadow-sm">
                            <AvatarImage src={avatarSrc} alt={user?.name} className="object-cover" onError={() => setAvatarSrc("")} />
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-none">{user?.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user?.email}</p>
                        </div>
                    </div>
                </div>
                <div className="p-2">
                    <DropdownMenuGroup>
                        <DropdownMenuItem asChild>
                            <Link href="/profile" className="cursor-pointer w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300 transition-colors outline-none focus:outline-none">
                                <User className="h-4 w-4" />
                                <span>My Profile</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-1" />
                    <DropdownMenuItem onSelect={(e) => {
                        e.preventDefault();
                        setShowLogoutDialog(true);
                    }} className="cursor-pointer w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 transition-colors">
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <AlertDialogContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Sign Out</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
                        Are you sure you want to sign out of the system?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout} className="rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 border-0">
                        Sign Out
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>);
}
