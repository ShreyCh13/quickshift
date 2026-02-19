"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { ChecklistItemRow, RemarkFieldRow, Session, UserRow } from "@/lib/types";
import { INSPECTION_CATEGORIES } from "@/lib/constants";
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
  useUpdateSupplier,
  useDeleteSupplier,
  useDrivers,
  useCreateDriver,
  useUpdateDriver,
  useDeleteDriver,
  useChecklistItems,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useVehicles,
  useInspectionsCount,
  useMaintenanceCount,
} from "@/hooks/useQueries";
import { buildExportUrl } from "./api";
import { ListSkeleton } from "@/components/Skeleton";
import { generateAppsScript } from "@/lib/SyncSettings";

type TabKey = "users" | "drivers" | "suppliers" | "database" | "sheet" | "checklist";

const ADMIN_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "users", label: "Users", icon: "👥" },
  { key: "drivers", label: "Drivers", icon: "🚗" },
  { key: "suppliers", label: "Suppliers", icon: "🏪" },
  { key: "checklist", label: "Checklist", icon: "📋" },
  { key: "database", label: "Database", icon: "💾" },
  { key: "sheet", label: "Sheet", icon: "📊" },
];

const STAFF_TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "drivers", label: "Drivers", icon: "🚗" },
  { key: "suppliers", label: "Suppliers", icon: "🏪" },
];

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [userEdits, setUserEdits] = useState<
    Record<string, { username: string; role: UserRow["role"]; password: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "staff" });
  const [newDriverName, setNewDriverName] = useState("");
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);
  const [editSupplierName, setEditSupplierName] = useState("");
  const [visiblePasswordId, setVisiblePasswordId] = useState<string | null>(null);
  const [localRemarkFields, setLocalRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [remarkOrderDirty, setRemarkOrderDirty] = useState(false);
  const [draggingRemarkId, setDraggingRemarkId] = useState<string | null>(null);
  const [dragOverRemarkId, setDragOverRemarkId] = useState<string | null>(null);
  const [newRemark, setNewRemark] = useState({ key: "", label: "", is_active: true });
  const [scriptCopied, setScriptCopied] = useState(false);
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  // Checklist management state
  const [localChecklistItems, setLocalChecklistItems] = useState<ChecklistItemRow[]>([]);
  const [checklistOrderDirty, setChecklistOrderDirty] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState({ category_key: "exterior", category_label: "Exterior Inspection", item_key: "", item_label: "" });
  const [editChecklistId, setEditChecklistId] = useState<string | null>(null);
  const [editChecklistLabel, setEditChecklistLabel] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(["exterior", "interior", "road_test"])
  );

  // React Query hooks
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useUsers();
  const { data: remarkFieldsData = [], isLoading: remarkFieldsLoading, refetch: refetchRemarkFields } = useRemarkFields();
  const { data: suppliers = [], isLoading: suppliersLoading, refetch: refetchSuppliers } = useSuppliers();
  const { data: drivers = [], isLoading: driversLoading, refetch: refetchDrivers } = useDrivers();
  const { data: checklistItemsData = [], isLoading: checklistLoading } = useChecklistItems();
  const { data: vehiclesData } = useVehicles(undefined, 1, 1);
  const { data: inspectionsCount } = useInspectionsCount();
  const { data: maintenanceCount } = useMaintenanceCount();

  // Mutations
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createRemarkFieldMutation = useCreateRemarkField();
  const updateRemarkFieldMutation = useUpdateRemarkField();
  const deleteRemarkFieldMutation = useDeleteRemarkField();
  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();
  const createDriverMutation = useCreateDriver();
  const updateDriverMutation = useUpdateDriver();
  const deleteDriverMutation = useDeleteDriver();
  const createChecklistItemMutation = useCreateChecklistItem();
  const updateChecklistItemMutation = useUpdateChecklistItem();
  const deleteChecklistItemMutation = useDeleteChecklistItem();

  useEffect(() => {
    if (checklistItemsData.length > 0 && !checklistOrderDirty) {
      setLocalChecklistItems(checklistItemsData as ChecklistItemRow[]);
      // Collapse all categories on first load
      const keys = new Set((checklistItemsData as ChecklistItemRow[]).map((i) => i.category_key));
      setCollapsedCategories(keys);
    }
  }, [checklistItemsData, checklistOrderDirty]);

  useEffect(() => {
    if (remarkFieldsData.length > 0 && !remarkOrderDirty) {
      setLocalRemarkFields(remarkFieldsData as RemarkFieldRow[]);
    }
  }, [remarkFieldsData, remarkOrderDirty]);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/login"); return; }
    setSession(s);
    // Staff land on drivers tab by default; dev and admin land on users tab
    if (s.user.role === "staff") setActiveTab("drivers");
  }, [router]);

  // ---- User actions ----
  function startUserEdit(user: UserRow) {
    setUserEdits((prev) => ({
      ...prev,
      [user.id]: { username: user.username, role: user.role, password: "" },
    }));
  }

  function cancelUserEdit(id: string) {
    setUserEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function updateUserEdit(id: string, patch: Partial<{ username: string; role: UserRow["role"]; password: string }>) {
    setUserEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleSaveUser(userId: string) {
    const editing = userEdits[userId];
    if (!editing) return;
    const payload: { id: string; username?: string; role?: string; password?: string } = {
      id: userId,
      username: editing.username,
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
    if (!newUser.username.trim() || !newUser.password.trim()) {
      setError("Name and password are required");
      return;
    }
    setError(null);
    try {
      await createUserMutation.mutateAsync(newUser);
      setNewUser({ username: "", password: "", role: "staff" });
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

  async function handleSaveSupplier(id: string) {
    if (!editSupplierName.trim()) { setError("Supplier name is required"); return; }
    setError(null);
    try {
      await updateSupplierMutation.mutateAsync({ id, name: editSupplierName.trim() });
      setEditSupplierId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update supplier");
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

  async function handleSaveDriver(id: string) {
    if (!editDriverName.trim()) { setError("Driver name is required"); return; }
    setError(null);
    try {
      await updateDriverMutation.mutateAsync({ id, name: editDriverName.trim() });
      setEditDriverId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update driver");
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

  // ---- Checklist item actions ----
  async function handleCreateChecklistItem() {
    if (!newChecklistItem.item_label.trim()) {
      setError("Item label is required");
      return;
    }
    setError(null);
    try {
      const maxOrder = localChecklistItems.filter((i) => i.category_key === newChecklistItem.category_key).length
        ? Math.max(...localChecklistItems.filter((i) => i.category_key === newChecklistItem.category_key).map((i) => i.sort_order)) + 1
        : 1;
      const autoKey = newChecklistItem.item_label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      await createChecklistItemMutation.mutateAsync({
        ...newChecklistItem,
        item_key: autoKey,
        item_label: newChecklistItem.item_label.trim(),
        sort_order: maxOrder,
        is_active: true,
      });
      setNewChecklistItem((prev) => ({ ...prev, item_key: "", item_label: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add checklist item");
    }
  }

  async function handleToggleChecklistItem(item: ChecklistItemRow) {
    setError(null);
    try {
      await updateChecklistItemMutation.mutateAsync({ ...item, is_active: !item.is_active });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    }
  }

  async function handleSaveChecklistLabel(item: ChecklistItemRow) {
    if (!editChecklistLabel.trim()) { setError("Label is required"); return; }
    setError(null);
    try {
      await updateChecklistItemMutation.mutateAsync({ ...item, item_label: editChecklistLabel.trim() });
      setEditChecklistId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update label");
    }
  }

  async function handleDeleteChecklistItem(id: string) {
    try {
      await deleteChecklistItemMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  }

  // ---- Google Sheet script ----
  async function handleCopyScript() {
    try {
      await navigator.clipboard.writeText(generateAppsScript());
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 3000);
    } catch {
      setError("Failed to copy to clipboard — try the preview instead");
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

  const isAdmin = session.user.role === "admin" || session.user.role === "dev";
  const isDev = session.user.role === "dev";
  // Dev sees all tabs; admin sees all except Sheet; staff see only their subset
  const TABS = isDev
    ? ADMIN_TABS
    : isAdmin
    ? ADMIN_TABS.filter((t) => t.key !== "sheet")
    : STAFF_TABS;

  const tabLoading = activeTab === "users" ? usersLoading
    : activeTab === "drivers" ? driversLoading
    : activeTab === "suppliers" ? suppliersLoading
    : false;

  return (
    <MobileShell title={isAdmin ? "Admin" : "Manage"}>
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
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-shrink-0 flex-col items-center justify-center rounded-lg px-3 py-2.5 text-xs font-medium transition ${
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
                                <div className="font-bold text-slate-900">{editing ? editing.username : user.username}</div>
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
                                value={editing.username}
                                onChange={(e) => updateUserEdit(user.id, { username: e.target.value })}
                                placeholder="Name"
                                autoComplete="off"
                              />
                              <select
                                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                                value={editing.role}
                                onChange={(e) => updateUserEdit(user.id, { role: e.target.value as "admin" | "staff" })}
                              >
                                <option value="admin">Admin</option>
                                <option value="staff">Staff</option>
                              </select>
                              <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                                <div className="mb-0.5 text-xs font-medium text-slate-500">Current Password</div>
                                <div className="font-mono text-sm text-slate-800 break-all">{user.password || "—"}</div>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-600">New Password (leave blank to keep current)</label>
                                <input
                                  type="text"
                                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-3 text-base focus:border-blue-500 focus:outline-none"
                                  value={editing.password}
                                  onChange={(e) => updateUserEdit(user.id, { password: e.target.value })}
                                  placeholder="Enter new password..."
                                  autoComplete="off"
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
                      <FormField label="Name" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="Enter name" />
                      <FormField label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Enter password" />
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
                        <div key={driver.id} className="rounded-lg border-2 border-slate-100 px-3 py-2.5">
                          {editDriverId === driver.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                className="flex-1 rounded-lg border-2 border-blue-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                value={editDriverName}
                                onChange={(e) => setEditDriverName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveDriver(driver.id); if (e.key === "Escape") setEditDriverId(null); }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveDriver(driver.id)}
                                disabled={updateDriverMutation.isPending}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditDriverId(null)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">🚗</span>
                                <span className="font-medium text-slate-900">{driver.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditDriverId(driver.id); setEditDriverName(driver.name); }}
                                  className="rounded p-1.5 text-slate-400 active:bg-slate-50"
                                >
                                  ✏️
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteDriver(driver.id)}
                                    disabled={deleteDriverMutation.isPending}
                                    className="rounded p-1.5 text-red-400 active:bg-red-50 disabled:opacity-50"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
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
                        <div key={supplier.id} className="rounded-lg border-2 border-slate-100 px-3 py-2.5">
                          {editSupplierId === supplier.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                className="flex-1 rounded-lg border-2 border-emerald-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                                value={editSupplierName}
                                onChange={(e) => setEditSupplierName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveSupplier(supplier.id); if (e.key === "Escape") setEditSupplierId(null); }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveSupplier(supplier.id)}
                                disabled={updateSupplierMutation.isPending}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditSupplierId(null)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400">🏪</span>
                                <span className="font-medium text-slate-900">{supplier.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditSupplierId(supplier.id); setEditSupplierName(supplier.name); }}
                                  className="rounded p-1.5 text-slate-400 active:bg-slate-50"
                                >
                                  ✏️
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteSupplier(supplier.id)}
                                    disabled={deleteSupplierMutation.isPending}
                                    className="rounded p-1.5 text-red-400 active:bg-red-50 disabled:opacity-50"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
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
                    <div className="flex justify-between"><span>Cars</span><span className="font-mono">{vehiclesData?.total ?? "—"}</span></div>
                    <div className="flex justify-between"><span>Inspections</span><span className="font-mono">{inspectionsCount ?? "—"}</span></div>
                    <div className="flex justify-between"><span>Maintenances</span><span className="font-mono">{maintenanceCount ?? "—"}</span></div>
                    <div className="flex justify-between"><span>Status</span><span className="text-emerald-400">Connected</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* ========== SHEET TAB ========== */}
            {activeTab === "sheet" && (
              <div className="space-y-4">
                {/* Header card */}
                <div className="rounded-xl bg-white p-4 shadow">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                      <svg className="h-5 w-5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Live Google Sheet</h2>
                      <p className="text-sm text-slate-500">
                        Auto-syncs Inspections, Maintenance &amp; Vehicle Summary tabs every 5 minutes.
                      </p>
                    </div>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={handleCopyScript}
                    className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
                      scriptCopied
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-emerald-600 text-white active:bg-emerald-700"
                    }`}
                  >
                    {scriptCopied ? (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Apps Script
                      </>
                    )}
                  </button>

                  {/* 3-step instructions */}
                  <div className="space-y-3">
                    {[
                      {
                        step: "1",
                        title: "Open your Google Sheet",
                        desc: "Go to Extensions → Apps Script to open the script editor.",
                      },
                      {
                        step: "2",
                        title: "Paste & Save",
                        desc: "Delete any existing code, paste the copied script, then press Ctrl+S (or ⌘+S) to save.",
                      },
                      {
                        step: "3",
                        title: "Authorize & Enable",
                        desc: `Run onOpen() once to authorize, then use the "State Fleet" menu → "Setup Auto-Refresh".`,
                      },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex gap-3">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {step}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{title}</div>
                          <div className="text-xs text-slate-500">{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview toggle */}
                <div className="rounded-xl bg-white shadow">
                  <button
                    onClick={() => setShowScriptPreview((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      {showScriptPreview ? "Hide" : "Preview"} Script
                    </span>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${showScriptPreview ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showScriptPreview && (
                    <div className="border-t border-slate-100 bg-slate-900 p-4 rounded-b-xl">
                      <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed text-emerald-300">
                        {generateAppsScript()}
                      </pre>
                    </div>
                  )}
                </div>

                {/* DB setup reminder */}
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <span className="text-sm font-bold text-amber-800">Database setup required</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Run <code className="rounded bg-amber-100 px-1 font-mono">migration_v3.sql</code> in Supabase SQL Editor to create the
                    Vehicle Summary view and grant the anon key read access for the Apps Script.
                  </p>
                </div>
              </div>
            )}

            {/* ========== CHECKLIST TAB ========== */}
            {activeTab === "checklist" && (
              <div className="space-y-4">
                {/* Add new item */}
                <div className="rounded-xl bg-white p-4 shadow">
                  <h2 className="mb-1 text-lg font-bold text-slate-900">Inspection Checklist</h2>
                  <p className="mb-4 text-sm text-slate-500">Manage the vehicle inspection checklist items. Run <code className="rounded bg-slate-100 px-1 font-mono text-xs">migration_v4.sql</code> first.</p>

                  <div className="mb-4 space-y-2 rounded-xl border-2 border-blue-100 bg-blue-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Add New Item</div>
                    <select
                      className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                      value={newChecklistItem.category_key}
                      onChange={(e) => {
                        const cat = INSPECTION_CATEGORIES.find((c) => c.key === e.target.value);
                        setNewChecklistItem((prev) => ({
                          ...prev,
                          category_key: e.target.value,
                          category_label: cat?.label ?? e.target.value,
                        }));
                      }}
                    >
                      {INSPECTION_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                    <input
                      className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Item label (e.g. AC Compressor)"
                      value={newChecklistItem.item_label}
                      onChange={(e) => setNewChecklistItem((prev) => ({ ...prev, item_label: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreateChecklistItem(); }}
                    />
                    <button
                      onClick={handleCreateChecklistItem}
                      disabled={createChecklistItemMutation.isPending}
                      className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                    >
                      {createChecklistItemMutation.isPending ? "Adding..." : "+ Add Item"}
                    </button>
                  </div>

                  {localChecklistItems.length > 0 && (
                    <div className="mb-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const allKeys = new Set(localChecklistItems.map((i) => i.category_key));
                          const allCollapsed = allKeys.size === collapsedCategories.size;
                          setCollapsedCategories(allCollapsed ? new Set() : allKeys);
                        }}
                        className="text-xs font-medium text-blue-600 active:text-blue-800"
                      >
                        {collapsedCategories.size === new Set(localChecklistItems.map((i) => i.category_key)).size
                          ? "Expand all"
                          : "Collapse all"}
                      </button>
                    </div>
                  )}

                  {checklistLoading ? (
                    <div className="py-4 text-center text-sm text-slate-400">Loading...</div>
                  ) : localChecklistItems.length === 0 ? (
                    <div className="rounded-lg bg-amber-50 p-4 text-center text-sm text-amber-700">
                      No items found. Run <code className="font-mono">migration_v4.sql</code> to seed the default checklist.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        const categoryMap = new Map<string, { label: string; items: ChecklistItemRow[] }>();
                        for (const item of localChecklistItems) {
                          if (!categoryMap.has(item.category_key)) {
                            categoryMap.set(item.category_key, { label: item.category_label, items: [] });
                          }
                          categoryMap.get(item.category_key)!.items.push(item);
                        }
                        return Array.from(categoryMap.entries()).map(([catKey, { label, items }]) => {
                          const isCollapsed = collapsedCategories.has(catKey);
                          return (
                          <div key={catKey} className="overflow-hidden rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setCollapsedCategories((prev) => {
                                const next = new Set(prev);
                                if (next.has(catKey)) next.delete(catKey); else next.add(catKey);
                                return next;
                              })}
                              className="flex w-full items-center justify-between bg-blue-600 px-4 py-2.5 active:bg-blue-700"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold uppercase tracking-wide text-white">{label}</span>
                                <span className="text-xs text-blue-200">{items.filter((i) => i.is_active).length}/{items.length} active</span>
                              </div>
                              <svg
                                className={`h-4 w-4 text-blue-200 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {!isCollapsed && <div className="divide-y divide-slate-100">
                              {items.map((item) => (
                                <div key={item.id} className={`px-3 py-2.5 ${!item.is_active ? "bg-slate-50 opacity-60" : ""}`}>
                                  {editChecklistId === item.id ? (
                                    <div className="flex items-center gap-2">
                                      <input
                                        className="flex-1 rounded-lg border-2 border-blue-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                                        value={editChecklistLabel}
                                        onChange={(e) => setEditChecklistLabel(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveChecklistLabel(item); if (e.key === "Escape") setEditChecklistId(null); }}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveChecklistLabel(item)}
                                        disabled={updateChecklistItemMutation.isPending}
                                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => setEditChecklistId(null)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-medium text-slate-900">{item.item_label}</div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={() => handleToggleChecklistItem(item)}
                                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                                        >
                                          {item.is_active ? "Active" : "Off"}
                                        </button>
                                        <button
                                          onClick={() => { setEditChecklistId(item.id); setEditChecklistLabel(item.item_label); }}
                                          className="rounded p-1.5 text-slate-400 active:bg-slate-50"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => handleDeleteChecklistItem(item.id)}
                                          disabled={deleteChecklistItemMutation.isPending}
                                          className="rounded p-1.5 text-red-400 active:bg-red-50 disabled:opacity-50"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>}
                          </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
