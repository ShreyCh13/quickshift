"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "@/components/MobileShell";
import FormField from "@/components/FormField";
import Toast from "@/components/Toast";
import { loadSession, getSessionHeader } from "@/lib/auth";
import type { RemarkFieldRow, Session, UserRow } from "@/lib/types";
import {
  buildExportUrl,
  createRemarkField,
  createUser,
  deleteRemarkField,
  deleteUser,
  fetchRemarkFields,
  fetchUsers,
  updateRemarkField,
  updateUser,
} from "./api";
import { ListSkeleton } from "@/components/Skeleton";

type TabKey = "categories" | "users" | "database";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "categories", label: "Categories", icon: "📁" },
  { key: "users", label: "Users", icon: "👥" },
  { key: "database", label: "Database", icon: "💾" },
];

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userEdits, setUserEdits] = useState<
    Record<string, { display_name: string; role: UserRow["role"]; password: string }>
  >({});
  const [remarkFields, setRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    display_name: "",
    role: "staff",
  });
  const [newRemark, setNewRemark] = useState({
    key: "",
    label: "",
    is_active: true,
  });
  const [draggingRemarkId, setDraggingRemarkId] = useState<string | null>(null);
  const [dragOverRemarkId, setDragOverRemarkId] = useState<string | null>(null);
  const [isSavingRemarkOrder, setIsSavingRemarkOrder] = useState(false);
  const [remarkOrderDirty, setRemarkOrderDirty] = useState(false);

  function startUserEdit(user: UserRow) {
    setUserEdits((prev) => ({
      ...prev,
      [user.id]: {
        display_name: user.display_name,
        role: user.role,
        password: user.password ?? "",
      },
    }));
  }

  function cancelUserEdit(id: string) {
    setUserEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateUserEdit(id: string, patch: Partial<{ display_name: string; role: UserRow["role"]; password: string }>) {
    setUserEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  useEffect(() => {
    const sessionData = loadSession();
    if (!sessionData) {
      router.replace("/login");
      return;
    }
    if (sessionData.user.role !== "admin") {
      router.replace("/vehicles");
      return;
    }
    setSession(sessionData);
  }, [router]);

  async function loadAdminData() {
    setLoading(true);
    const [userRes, remarkRes] = await Promise.all([fetchUsers(), fetchRemarkFields()]);
    setUsers(userRes.users || []);
    setRemarkFields(remarkRes.remarkFields || []);
    setRemarkOrderDirty(false);
    setLoading(false);
  }

  useEffect(() => {
    if (!session) return;
    loadAdminData();
  }, [session]);

  async function handleCreateUser() {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.display_name.trim()) {
      setError("All fields are required");
      return;
    }
    setError(null);
    const res = await createUser(newUser);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewUser({ username: "", password: "", display_name: "", role: "staff" });
    setShowAddUser(false);
    loadAdminData();
  }

  async function handleCreateRemark() {
    if (!newRemark.key.trim() || !newRemark.label.trim()) {
      setError("Key and Label are required");
      return;
    }
    setError(null);
    const res = await createRemarkField({
      key: newRemark.key,
      label: newRemark.label,
      sort_order: remarkFields.length
        ? Math.max(...remarkFields.map((field) => field.sort_order || 0)) + 1
        : 1,
      is_active: newRemark.is_active,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewRemark({ key: "", label: "", is_active: true });
    loadAdminData();
  }

  function moveRemarkField(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setRemarkFields((prev) => {
      const fromIndex = prev.findIndex((field) => field.id === sourceId);
      const toIndex = prev.findIndex((field) => field.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const reordered = next.map((field, index) => ({
        ...field,
        sort_order: index + 1,
      }));
      return reordered;
    });
    setRemarkOrderDirty(true);
  }

  async function handleSaveRemarkOrder() {
    setError(null);
    setIsSavingRemarkOrder(true);
    const results = await Promise.all(
      remarkFields.map((field) =>
        updateRemarkField({
          id: field.id,
          key: field.key,
          label: field.label,
          sort_order: field.sort_order,
          is_active: field.is_active,
        }),
      ),
    );
    const failed = results.find((res) => res.error);
    if (failed?.error) {
      setError(failed.error);
    } else {
      await loadAdminData();
    }
    setIsSavingRemarkOrder(false);
  }

  const exportVehicles = useMemo(() => buildExportUrl({ type: "vehicles", format: "xlsx" }), []);
  const exportInspections = useMemo(() => buildExportUrl({ type: "inspections", format: "xlsx" }), []);
  const exportMaintenance = useMemo(() => buildExportUrl({ type: "maintenance", format: "xlsx" }), []);

  async function downloadExport(url: string, filename: string) {
    const res = await fetch(url, { headers: { ...getSessionHeader() } });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  if (!session) return null;

  return (
    <MobileShell title="Admin">
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white p-4 pb-24">
        {/* Sync Status */}
        <div className="mb-4 flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-slate-600">REAL-TIME SYNC ACTIVE</span>
          </div>
          <span className="text-xs text-slate-400">
            Updated {new Date().toLocaleTimeString()}
          </span>
        </div>

        {error && <Toast message={error} tone="error" />}

        {/* Tabs */}
        <div className="mb-4 rounded-xl bg-white p-2 shadow">
          <div className="grid grid-cols-3 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex flex-col items-center justify-center rounded-lg py-3 text-xs font-medium transition ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 active:bg-slate-100"
                }`}
              >
                <span className="mb-1 text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content based on active tab */}
        {loading ? (
          <ListSkeleton count={4} />
        ) : (
          <>
            {/* Categories Tab - Remark Fields */}
            {activeTab === "categories" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Inspection Categories</h2>
                    {remarkOrderDirty && (
                      <button
                        onClick={handleSaveRemarkOrder}
                        disabled={isSavingRemarkOrder}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                      >
                        {isSavingRemarkOrder ? "Saving..." : "Save Order"}
                      </button>
                    )}
                  </div>
                  <p className="mb-4 text-sm text-slate-500">Drag to reorder categories</p>

                  <div className="space-y-2">
                    {remarkFields.map((field) => (
                      <div
                        key={field.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/remark", field.id);
                          setDraggingRemarkId(field.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverRemarkId !== field.id) setDragOverRemarkId(field.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverRemarkId === field.id) setDragOverRemarkId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceId = e.dataTransfer.getData("text/remark");
                          moveRemarkField(sourceId, field.id);
                          setDraggingRemarkId(null);
                          setDragOverRemarkId(null);
                        }}
                        onDragEnd={() => {
                          setDraggingRemarkId(null);
                          setDragOverRemarkId(null);
                        }}
                        className={`flex items-center justify-between rounded-lg border-2 p-3 transition ${
                          draggingRemarkId === field.id
                            ? "border-slate-300 bg-slate-50 opacity-50"
                            : dragOverRemarkId === field.id
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="cursor-grab text-slate-400">☰</span>
                          <div>
                            <div className="font-semibold text-slate-900">{field.label}</div>
                            <div className="text-xs text-slate-500">{field.key}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                            field.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>
                            {field.is_active ? "Active" : "Inactive"}
                          </span>
                          <button
                            onClick={() => deleteRemarkField(field.id).then(loadAdminData)}
                            className="rounded p-1 text-red-500 active:bg-red-50"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add New Category */}
                  <div className="mt-4 rounded-lg border-2 border-dashed border-slate-200 p-4">
                    <h3 className="mb-3 font-semibold text-slate-700">Add New Category</h3>
                    <div className="space-y-3">
                      <FormField
                        label="Key (no spaces)"
                        value={newRemark.key}
                        onChange={(e) => setNewRemark({ ...newRemark, key: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                        placeholder="e.g. engine_check"
                      />
                      <FormField
                        label="Display Label"
                        value={newRemark.label}
                        onChange={(e) => setNewRemark({ ...newRemark, label: e.target.value })}
                        placeholder="e.g. Engine Check"
                      />
                      <button
                        onClick={handleCreateRemark}
                        className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white active:bg-emerald-700"
                      >
                        Add Category
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">User Management</h2>
                      <p className="text-sm text-slate-500">Add, edit, or remove users and their permissions</p>
                    </div>
                    <button
                      onClick={() => setShowAddUser(!showAddUser)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white active:bg-emerald-700"
                    >
                      + Add User
                    </button>
                  </div>

                  <div className="mb-2 text-xs font-medium text-slate-500">{users.length} USERS</div>

                  <div className="space-y-3">
                    {users.map((user) => {
                      const editing = userEdits[user.id];
                      const isCurrentUser = user.id === session?.user.id;

                      return (
                        <div key={user.id} className="rounded-xl border-2 border-slate-100 p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                user.role === "admin" ? "bg-purple-100" : "bg-slate-100"
                              }`}>
                                {user.role === "admin" ? "👑" : "👤"}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{user.display_name}</div>
                                <div className="text-sm text-slate-500">@{user.username}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700"
                              }`}>
                                {user.role.toUpperCase()}
                              </span>
                              {isCurrentUser && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  YOU
                                </span>
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
                              <input
                                type="password"
                                className="w-full rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                                value={editing.password}
                                onChange={(e) => updateUserEdit(user.id, { password: e.target.value })}
                                placeholder="New Password (leave blank to keep)"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const payload: Record<string, unknown> = {
                                      id: user.id,
                                      display_name: editing.display_name,
                                      role: editing.role,
                                    };
                                    if (editing.password.trim()) {
                                      payload.password = editing.password;
                                    }
                                    updateUser(payload).then(() => {
                                      cancelUserEdit(user.id);
                                      loadAdminData();
                                    });
                                  }}
                                  className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800"
                                >
                                  Save
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
                            <div className="mt-3 flex gap-2 border-t pt-3">
                              <div className="flex-1 text-center">
                                <div className="text-xs text-slate-400">Password</div>
                                <div className="font-mono text-sm text-slate-600">••••••••</div>
                              </div>
                              <button
                                onClick={() => startUserEdit(user)}
                                className="rounded-lg border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
                              >
                                Edit
                              </button>
                              {!isCurrentUser && (
                                <button
                                  onClick={() => deleteUser(user.id).then(loadAdminData)}
                                  className="rounded-lg bg-red-100 p-2 text-red-600 active:bg-red-200"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add User Form */}
                {showAddUser && (
                  <div className="rounded-xl bg-emerald-50 p-4 shadow">
                    <h3 className="mb-3 font-bold text-slate-900">Add New User</h3>
                    <div className="space-y-3">
                      <FormField
                        label="Username"
                        value={newUser.username}
                        onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                        placeholder="Enter username"
                      />
                      <FormField
                        label="Password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Enter password"
                      />
                      <FormField
                        label="Display Name"
                        value={newUser.display_name}
                        onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                        placeholder="Enter display name"
                      />
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
                          className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-semibold text-white active:bg-emerald-700"
                        >
                          Create User
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

            {/* Database Tab - Exports */}
            {activeTab === "database" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white p-4 shadow">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">Export Data</h2>
                  <p className="mb-4 text-sm text-slate-500">Download your data as Excel files</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => downloadExport(exportVehicles, "vehicles.xlsx")}
                      className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 p-4 text-left active:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🚗</span>
                        <div>
                          <div className="font-semibold text-slate-900">Vehicles</div>
                          <div className="text-xs text-slate-500">Export all vehicle data</div>
                        </div>
                      </div>
                      <span className="text-slate-400">⬇️</span>
                    </button>
                    <button
                      onClick={() => downloadExport(exportInspections, "inspections.xlsx")}
                      className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 p-4 text-left active:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📋</span>
                        <div>
                          <div className="font-semibold text-slate-900">Inspections</div>
                          <div className="text-xs text-slate-500">Export all inspection records</div>
                        </div>
                      </div>
                      <span className="text-slate-400">⬇️</span>
                    </button>
                    <button
                      onClick={() => downloadExport(exportMaintenance, "maintenance.xlsx")}
                      className="flex w-full items-center justify-between rounded-lg border-2 border-slate-200 p-4 text-left active:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🔧</span>
                        <div>
                          <div className="font-semibold text-slate-900">Maintenance</div>
                          <div className="text-xs text-slate-500">Export all maintenance records</div>
                        </div>
                      </div>
                      <span className="text-slate-400">⬇️</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 p-4 text-white shadow">
                  <h3 className="mb-2 font-bold">Database Status</h3>
                  <div className="space-y-1 text-sm text-slate-300">
                    <div className="flex justify-between">
                      <span>Users</span>
                      <span className="font-mono">{users.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Categories</span>
                      <span className="font-mono">{remarkFields.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className="text-emerald-400">Connected</span>
                    </div>
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
