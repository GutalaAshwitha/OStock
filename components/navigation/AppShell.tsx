"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  ClipboardList,
  Truck,
  ArrowDownToLine,
  Sliders,
  History,
  Settings,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Package,
  Warehouse,
  Tags,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        setUserName(name);
      }
    }
    loadUser();
  }, [supabase]);

  // Auto-expand Operations or Settings if on a sub-route
  useEffect(() => {
    if (
      pathname.startsWith("/receipts") ||
      pathname.startsWith("/deliveries") ||
      pathname.startsWith("/transfers") ||
      pathname.startsWith("/adjustments") ||
      pathname.startsWith("/history")
    ) {
      setOperationsOpen(true);
    }
    if (pathname.startsWith("/settings")) {
      setSettingsOpen(true);
    }
    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  const isOperationsActive =
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/deliveries") ||
    pathname.startsWith("/transfers") ||
    pathname.startsWith("/adjustments") ||
    pathname.startsWith("/history");

  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Package className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              OStock
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200"
          >
            {userName ? userName.charAt(0).toUpperCase() : "U"}
          </Link>
        </div>
      </div>

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop permanent + Mobile slide-over) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 group focus:outline-none"
          >
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30 group-hover:scale-105 transition">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white block">
                OStock
              </span>
              <span className="text-[10px] text-blue-400 font-medium tracking-wide uppercase">
                Inventory Suite
              </span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Main Dashboard */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive("/dashboard")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          {/* Products */}
          <Link
            href="/products"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive("/products") || isActive("/categories")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Products</span>
          </Link>

          {/* Operations Expandable Group */}
          <div>
            <button
              type="button"
              onClick={() => setOperationsOpen(!operationsOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                isOperationsActive
                  ? "text-blue-400 bg-slate-800/60 font-semibold"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                <span>Operations</span>
              </div>
              {operationsOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {operationsOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                <Link
                  href="/receipts"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/receipts")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Receipts</span>
                </Link>

                <Link
                  href="/deliveries"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/deliveries")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Deliveries</span>
                </Link>

                <Link
                  href="/transfers"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/transfers")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Internal Transfers</span>
                </Link>

                <Link
                  href="/adjustments"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/adjustments")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Adjustments</span>
                </Link>

                <Link
                  href="/history"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/history")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Move History</span>
                </Link>
              </div>
            )}
          </div>

          {/* Settings Expandable */}
          <div>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                isSettingsActive
                  ? "text-blue-400 bg-slate-800/60 font-semibold"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </div>
              {settingsOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {settingsOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                <Link
                  href="/categories"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/categories")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Tags className="w-3.5 h-3.5" />
                  <span>Product Categories</span>
                </Link>
                <Link
                  href="/settings/warehouses"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                    isActive("/settings/warehouses")
                      ? "bg-blue-600/20 text-blue-300 border-r-2 border-blue-500 font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Warehouse className="w-3.5 h-3.5" />
                  <span>Warehouses</span>
                </Link>
              </div>
            )}
          </div>

          {/* Profile */}
          <Link
            href="/profile"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive("/profile")
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </div>

        {/* User Card & Logout at bottom */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center font-bold text-xs text-white">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {userName || (userEmail ? userEmail.split("@")[0] : "Account")}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {userEmail || "Signed in"}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
