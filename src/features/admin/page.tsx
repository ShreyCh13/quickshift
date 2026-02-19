"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { RemarkFieldRow, Session, UserRow } from "@/lib/types";
import {
  useUsers,
  useRemarkFields,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useCreateRemarkField,
  useUpdateRemarkField,
  useDeleteRemarkField,
  useSuppliers,
  useCreateSupplier,
  useDeleteSupplier,
  useDrivers,
  useCreateDriver,
  useDeleteDriver,
} from "@/hooks/useQueries";
import { buildExportUrl } from "./api";
import { ListSkeleton } from "@/components/Skeleton";

type TabKey = "users" | "drivers" | "suppliers" | "database";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "users", label: "Users", icon: "👥" },
  { key: "drivers", label: "Drivers", icon: "🚗" },
  { key: "suppliers", label: "Suppliers", icon: "🏪" },
  { key: "database", label: "Database", icon: "💾" },
];

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [userEdits, setUserEdits] = useState<
    Record<string, { display_name: string; role: UserRow["role"]; password: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", display_name: "", role: "staff" });
  const [newDriverName, setNewDriverName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);
  const [localRemarkFields, setLocalRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [remarkOrderDirty, setRemarkOrderDirty] = useState(false);
  const [draggingRemarkId, setDraggingRemarkId] = useState<string | null>(null);
  const [dragOverRemarkId, setDragOverRemarkId] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState({ key: "", label: "", is_active: true });

  // React Query hooks
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: remarkFieldsData = [], isLoading: remarkFieldsLoading, refetch: refetchRemarkFields } = useRemarkFields();
  const { data: suppliers = [], isLoading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers();
  const { data: drivers = [], isLoading: driversLoading, refetch: refetchDrivers } = useDrivers();

  // Mutations
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createRemarkFieldMutation = useCreateRemarkField();
  const updateRemarkFieldMutation = useUpdateRemarkField();
  const deleteRemarkFieldMutation = useDeleteRemarkField();
  const createSupplierMutation = useCreateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();
  const createDriverMutation = useCreateDriver();
  const deleteDriverMutation = useDeleteDriver();

  useEffect(() => {
    if (remarkFieldsData.length > 0 && !remarkOrderDirty) {
      setLocalRemarkFields(remarkFieldsData as RemarkFieldRow[]);
    }
  }, [remarkFieldsData, remarkOrderDirty]);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/login"); return; }
    if (s.user.role !== "admin") { router.replace("/vehicles"); return; }
    setSession(s);
  }, [router]);

  // ---- User actions ----
  function startUserEdit(user: UserRow) {
    setUserEdits((prev) => ({
      ...prev,
      [user.id]: { display_name: user.display_name, role: user.role, password: "" },
    }));
  }

  function cancelUserEdit(id: string) {
    setUserEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function updateUserEdit(id: string, patch: Partial<{ display_name: string; role: UserRow["role"]; password: string }>) {
    setUserEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSaveUser(userId: string) {
    const editing = userEdits[userId];
    if (!editing) return;
    const payload: { id: string; display_name?: string; role?: string; password?: string } = {
      id: userId,
      display_name: editing.display_name,
      role: editing.role,
    };
    if (editing.password.trim()) payload.password = editing.password;
    try {
      await updateUserMutation.mutateAsync(payload);
      cancelUserEdit(userId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  async function handleCreateUser() {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.display_name.trim()) {
      setError("All fields are required");
      return;
    }
    setError(null);
    try {
      await createUserMutation.mutateAsync(newUser);
      setNewUser({ username: "", password: "", display_name: "", role: "staff" });
      setShowAddUser(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    }
  }

  async function handleDeleteUser(id: string) {
    try {
      await deleteUserMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  // ---- Supplier actions ----
  async function handleCreateSupplier() {
    if (!newSupplierName.trim()) { setError("Supplier name is required"); return; }
    setError(null);
    try {
      await createSupplierMutation.mutateAsync(newSupplierName.trim());
      setNewSupplierName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add supplier");
    }
  }

  async function handleDeleteSupplier(id: string) {
    try {
      await deleteSupplierMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete supplier");
    }
  }

  // ---- Driver actions ----
  async function handleCreateDriver() {
    if (!newDriverName.trim()) { setError("Driver name is required"); return; }
    setError(null);
    try {
      await createDriverMutation.mutateAsync(newDriverName.trim());
      setNewDriverName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add driver");
    }
  }

  async function handleDeleteDriver(id: string) {
    try {
      await deleteDriverMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete driver");
    }
  }

  // ---- Remark field actions ----
  async function handleCreateRemark() {
    if (!newRemark.key.trim() || !newRemark.label.trim()) { setError("Key and Label are required"); return; }
    setError(null);
    try {
      await createRemarkFieldMutation.mutateAsync({
        key: newRemark.key,
        label: newRemark.label,
        sort_order: localRemarkFields.length
          ? Math.max(...localRemarkFields.map((f) => f.sort_order || 0)) + 1 : 1,
        is_active: newRemark.is_active,
      });
      setNewRemark({ key: "", label: "", is_active: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  function moveRemarkField(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setLocalRemarkFields((prev) => {
      const from = prev.findIndex((f) => f.id === sourceId);
      const to = prev.findIndex((f) => f.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((f, i) => ({ ...f, sort_order: i + 1 }));
    });
    setRemarkOrderDirty(true);
  }

  async function handleSaveRemarkOrder() {
    setError(null);
    try {
      await Promise.all(
        localRemarkFields.map((f) =>
          updateRemarkFieldMutation.mutateAsync({ id: f.id, key: f.key, label: f.label, sort_order: f.sort_order, is_active: f.is_active })
        )
      );
      setRemarkOrderDirty(false);
      refetchRemarkFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    }
  }

  async function handleDeleteRemarkField(id: string) {
    try {
      await deleteRemarkFieldMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  // ---- Exports ----
  const exportVehicles = useMemo(() => buildExportUrl({ type: "vehicles", format: "xlsx" }), []);
  const exportInspections = useMemo(() => buildExportUrl({ type: "inspections", format: "xlsx" }), []);
  const exportMaintenance = useMemo(() => buildExportUrl({ type: "maintenance", format: "xlsx" }), []);

  async function downloadExport(url: string, filename: string) {
    const res = await fetch(url, { headers: { ...getSessionHeader() } });
    if (!res.ok) { setError("Export failed"); return; }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objUrl);
  }

  if (!session) return null;

  const tabLoading = activeTab === "users" ? usersLoading
    : activeTab === "drivers" ? driversLoading
    : activeTab === "suppliers" ? suppliersLoading
    : false;

  return (
    <MobileShell title="Admin">
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white p-4 pb-24">
        {/* Sync indicator */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">LIVE SYNC</span>
          </div>
          <span className="text-xs text-slate-400">Updated {new Date().toLocaleTimeString()}</span>
        </div>

        {error && <Toast message={error} tone="error" />}

        {/* Tabs */}
        <div className="mb-4 rounded-xl bg-white p-2 shadow">
          <div className="grid grid-cols-4 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center justify-center rounded-lg py-2.5 text-xs font-medium transition ${
                  activeTab === tab.key ? "bg-slate-900 text-white" : "text-slate-600 active:bg-slate-100"
                }`}
              >
                <span className="mb-0.5 text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {tabLoading ? (
          <ListSkeleton count={4} />
        ) : (
          <>
            {/* ========== USERS TAB ========== */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">User Management</h2>
                      <p className="text-sm text-slate-500">Manage users and their permissions</p>
                    </div>
                    <button
                      onClick={() => setShowAddUser(!showAddUser)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Password change notice */}
                  <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <strong>Security note:</strong> Changing a password will automatically log out that user on their next page load.
                  </div>

                  <div className="mb-2 text-xs font-medium text-slate-500">{users.length} USERS</div>

                  <div className="space-y-3">
                    {(users as UserRow[]).map((user) => {
                      const editing = userEdits[user.id];
                      const isCurrentUser = user.id === session?.user.id;

                      return (
                        <div key={user.id} className="rounded-xl border-2 border-slate-100 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${user.role === "admin" ? "bg-purple-100" : "bg-slate-100"}`}>
                                {user.role === "admin" ? "👑" : "👤"}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{user.display_name}</div>
                                <div className="text-sm text-slate-500">@{user.username}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"}`}>
                                {user.role.toUpperCase()}
                              </span>
                              {isCurrentUser && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">YOU</span>
                              )}
                            </div>
                          </div>

                          {editing ? (
                            <div className="mt-4 space-y-3 border-t pt-4">
                              <input
                                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                                value={editing.display_name}
                                onChange={(e) => updateUserEdit(user.id, { display_name: e.target.value })}
                                placeholder="Display Name"
                              />
                              <select
                                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                                value={editing.role}
                                onChange={(e) => updateUserEdit(user.id, { role: e.target.value as "admin" | "staff" })}
                              >
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                              </select>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">New Password (leave blank to keep current)</label>
                                <input
                                  type="password"
                                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
                                  value={editing.password}
                                  onChange={(e) => updateUserEdit(user.id, { password: e.target.value })}
                                  placeholder="Enter new password..."
                                  autoComplete="new-password"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveUser(user.id)}
                                  disabled={updateUserMutation.isPending}
                                  className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800 disabled:opacity-50"
                                >
                                  {updateUserMutation.isPending ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => cancelUserEdit(user.id)}
                                  className="flex-1 rounded-lg border-2 border-slate-300 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3 border-t pt-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="text-xs text-slate-400">Password</div>
                                  <div className="font-mono text-sm text-slate-600 break-all">
                                    {visiblePasswordId === user.id ? (user.password || "—") : "••••••••"}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setVisiblePasswordId(visiblePasswordId === user.id ? null : user.id)}
                                  className="min-w-[60px] rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
                                >
                                  {visiblePasswordId === user.id ? "Hide" : "View"}
                                </button>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startUserEdit(user)}
                                  className="flex-1 rounded-lg border-2 border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
                                >
                                  Edit
                                </button>
                                {!isCurrentUser && (
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={deleteUserMutation.isPending}
                                    className="rounded-lg bg-red-100 px-4 py-2.5 text-red-600 active:bg-red-200 disabled:opacity-50"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {showAddUser && (
                  <div className="rounded-xl bg-emerald-50 p-4 shadow">
                    <h3 className="mb-3 font-bold text-slate-900">Add New User</h3>
                    <div className="space-y-3">
                      <FormField label="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Enter username" />
                      <FormField label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password" />
                      <FormField label="Display Name" value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="Enter display name" />
                      <label className="block">
                        <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
                        <select
                          className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateUser}
                          disabled={createUserMutation.isPending}
                          className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                        >
                          {createUserMutation.isPending ? "Creating..." : "Create User"}
                        </button>
                        <button
                          onClick={() => setShowAddUser(false)}
                          className="flex-1 rounded-lg border-2 border-slate-300 bg-white py-2.5 font-semibold text-slate-700 active:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========== DRIVERS TAB ========== */}
            {activeTab === "drivers" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <h2 className="mb-1 text-lg font-bold text-slate-900">Driver Names</h2>
                  <p className="mb-4 text-sm text-slate-500">Manage the driver name list used in inspections</p>

                  {/* Add driver */}
                  <div className="mb-4 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Add new driver name..."
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateDriver(); }}
                    />
                    <button
                      onClick={handleCreateDriver}
                      disabled={createDriverMutation.isPending}
                      className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                    >
                      {createDriverMutation.isPending ? "..." : "Add"}
                    </button>
                  </div>

                  <div className="text-xs font-medium text-slate-500 mb-2">{drivers.length} DRIVERS</div>

                  {drivers.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">
                      No drivers yet. Add your first driver above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {drivers.map((driver) => (
                        <div key={driver.id} className="flex items-center justify-between rounded-lg border-2 border-slate-100 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">🚗</span>
                            <span className="font-medium text-slate-900">{driver.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteDriver(driver.id)}
                            disabled={deleteDriverMutation.isPending}
                            className="rounded p-1 text-red-400 active:bg-red-50 disabled:opacity-50"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== SUPPLIERS TAB ========== */}
            {activeTab === "suppliers" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <h2 className="mb-1 text-lg font-bold text-slate-900">Supplier Names</h2>
                  <p className="mb-4 text-sm text-slate-500">Manage the supplier name list used in maintenance records</p>

                  {/* Add supplier */}
                  <div className="mb-4 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="Add new supplier name..."
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateSupplier(); }}
                    />
                    <button
                      onClick={handleCreateSupplier}
                      disabled={createSupplierMutation.isPending}
                      className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                    >
                      {createSupplierMutation.isPending ? "..." : "Add"}
                    </button>
                  </div>

                  <div className="text-xs font-medium text-slate-500 mb-2">{suppliers.length} SUPPLIERS</div>

                  {suppliers.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-400">
                      No suppliers yet. Add your first supplier above.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {suppliers.map((supplier) => (
                        <div key={supplier.id} className="flex items-center justify-between rounded-lg border-2 border-slate-100 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">🏪</span>
                            <span className="font-medium text-slate-900">{supplier.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            disabled={deleteSupplierMutation.isPending}
                            className="rounded p-1 text-red-400 active:bg-red-50 disabled:opacity-50"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== DATABASE TAB ========== */}
            {activeTab === "database" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">Export Data</h2>
                  <p className="mb-4 text-sm text-slate-500">Download your data as Excel files</p>
                  <div className="space-y-2">
                    {[
                      { label: "Vehicles", icon: "🚗", url: exportVehicles, filename: "vehicles.xlsx" },
                      { label: "Inspections", icon: "📋", url: exportInspections, filename: "inspections.xlsx" },
                      { label: "Maintenance", icon: "🔧", url: exportMaintenance, filename: "maintenance.xlsx" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() => downloadExport(item.url, item.filename)}
                        className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 p-4 text-left active:bg-slate-50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <div className="font-semibold text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500">Export all {item.label.toLowerCase()} data</div>
                          </div>
                        </div>
                        <span className="text-slate-400">⬇️</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-4 text-white shadow">
                  <h3 className="mb-2 font-bold">Database Status</h3>
                  <div className="space-y-1 text-sm text-slate-300">
                    <div className="flex justify-between"><span>Users</span><span className="font-mono">{users.length}</span></div>
                    <div className="flex justify-between"><span>Suppliers</span><span className="font-mono">{suppliers.length}</span></div>
                    <div className="flex justify-between"><span>Drivers</span><span className="font-mono">{drivers.length}</span></div>
                    <div className="flex justify-between"><span>Status</span><span className="text-emerald-400">Connected</span></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
