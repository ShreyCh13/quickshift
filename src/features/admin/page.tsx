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
import { AdminSection } from "./components";

type SectionKey = "users" | "remarks" | "exports";

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userEdits, setUserEdits] = useState<
    Record<string, { display_name: string; role: UserRow["role"]; password: string }>
  >({});
  const [remarkFields, setRemarkFields] = useState<RemarkFieldRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("users");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    display_name: "",
    role: "staff",
  });
  const [newRemark, setNewRemark] = useState({
    key: "",
    label: "",
    sort_order: "",
    is_active: true,
  });

  function startUserEdit(user: UserRow) {
    setUserEdits((prev) => ({
      ...prev,
      [user.id]: { display_name: user.display_name, role: user.role, password: "" },
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
    const [userRes, remarkRes] = await Promise.all([fetchUsers(), fetchRemarkFields()]);
    setUsers(userRes.users || []);
    setRemarkFields(remarkRes.remarkFields || []);
  }

  useEffect(() => {
    if (!session) return;
    loadAdminData();
  }, [session]);

  async function handleCreateUser() {
    setError(null);
    const res = await createUser(newUser);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewUser({ username: "", password: "", display_name: "", role: "staff" });
    loadAdminData();
  }

  async function handleCreateRemark() {
    setError(null);
    const res = await createRemarkField({
      key: newRemark.key,
      label: newRemark.label,
      sort_order: newRemark.sort_order ? Number(newRemark.sort_order) : 0,
      is_active: newRemark.is_active,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewRemark({ key: "", label: "", sort_order: "", is_active: true });
    loadAdminData();
  }

  const exportVehicles = useMemo(() => buildExportUrl({ type: "vehicles", format: "xlsx" }), []);
  const exportInspections = useMemo(
    () => buildExportUrl({ type: "inspections", format: "xlsx" }),
    [],
  );
  const exportMaintenance = useMemo(
    () => buildExportUrl({ type: "maintenance", format: "xlsx" }),
    [],
  );

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

  return (
    <MobileShell title="Admin">
      <div className="space-y-4">
        {error ? <Toast message={error} tone="error" /> : null}

        <div className="rounded-lg border bg-white p-3">
          <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveSection("users")}
              className={`h-10 rounded-md ${activeSection === "users" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("remarks")}
              className={`h-10 rounded-md ${activeSection === "remarks" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              Remarks
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("exports")}
              className={`h-10 rounded-md ${activeSection === "exports" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              Exports
            </button>
          </div>
        </div>

        {activeSection === "exports" && (
          <AdminSection title="Exports (full dataset)">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => downloadExport(exportVehicles, "vehicles.xlsx")}
                className="h-11 rounded-md bg-slate-900 text-center text-sm font-semibold text-white"
              >
                Export Vehicles
              </button>
              <button
                type="button"
                onClick={() => downloadExport(exportInspections, "inspections.xlsx")}
                className="h-11 rounded-md bg-slate-900 text-center text-sm font-semibold text-white"
              >
                Export Inspections
              </button>
              <button
                type="button"
                onClick={() => downloadExport(exportMaintenance, "maintenance.xlsx")}
                className="h-11 rounded-md bg-slate-900 text-center text-sm font-semibold text-white"
              >
                Export Maintenance
              </button>
            </div>
          </AdminSection>
        )}

        {activeSection === "users" && (
          <AdminSection title="Users">
            <div className="space-y-2">
              {users.map((user) => {
                const editing = userEdits[user.id];
                return (
                <div key={user.id} className="rounded-md border p-2">
                  <div className="text-sm font-semibold">{user.username}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-md border px-2 text-sm"
                      value={editing ? editing.display_name : user.display_name}
                      disabled={!editing}
                      onChange={(e) => updateUserEdit(user.id, { display_name: e.target.value })}
                    />
                    <select
                      className="h-10 rounded-md border px-2 text-sm"
                      value={editing ? editing.role : user.role}
                      disabled={!editing}
                      onChange={(e) => updateUserEdit(user.id, { role: e.target.value as "admin" | "staff" })}
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                    </select>
                    {editing && (
                      <input
                        type="password"
                        className="col-span-2 h-10 rounded-md border px-2 text-sm"
                        placeholder="New password"
                        value={editing.password}
                        onChange={(e) => updateUserEdit(user.id, { password: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-semibold text-white"
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
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="h-10 flex-1 rounded-md border border-slate-300 text-sm font-semibold text-slate-700"
                          onClick={() => cancelUserEdit(user.id)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-semibold text-white"
                        onClick={() => startUserEdit(user)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="h-10 flex-1 rounded-md bg-red-600 text-sm font-semibold text-white"
                      onClick={() => deleteUser(user.id).then(loadAdminData)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
            <div className="mt-3 space-y-2 rounded-md border p-2">
              <div className="text-sm font-semibold">Add User</div>
              <FormField
                label="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
              <FormField
                label="Password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              <FormField
                label="Display Name"
                value={newUser.display_name}
                onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
              />
              <label className="block text-sm">
                <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-base"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              <button
                type="button"
                onClick={handleCreateUser}
                className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white"
              >
                Create User
              </button>
            </div>
          </AdminSection>
        )}

        {activeSection === "remarks" && (
          <AdminSection title="Remark Fields">
            <div className="space-y-2">
              {remarkFields.map((field) => (
                <div key={field.id} className="rounded-md border p-2">
                  <div className="text-sm font-semibold">{field.key}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-md border px-2 text-sm"
                      value={field.label}
                      onChange={(e) =>
                        setRemarkFields((prev) =>
                          prev.map((f) => (f.id === field.id ? { ...f, label: e.target.value } : f)),
                        )
                      }
                    />
                    <input
                      className="h-10 rounded-md border px-2 text-sm"
                      value={field.sort_order}
                      onChange={(e) =>
                        setRemarkFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id ? { ...f, sort_order: Number(e.target.value) } : f,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.is_active}
                        onChange={(e) =>
                          setRemarkFields((prev) =>
                            prev.map((f) => (f.id === field.id ? { ...f, is_active: e.target.checked } : f)),
                          )
                        }
                      />
                      Active
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="h-10 flex-1 rounded-md bg-slate-900 text-sm font-semibold text-white"
                      onClick={() =>
                        updateRemarkField({
                          id: field.id,
                          key: field.key,
                          label: field.label,
                          sort_order: field.sort_order,
                          is_active: field.is_active,
                        }).then(loadAdminData)
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="h-10 flex-1 rounded-md bg-red-600 text-sm font-semibold text-white"
                      onClick={() => deleteRemarkField(field.id).then(loadAdminData)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 space-y-2 rounded-md border p-2">
              <div className="text-sm font-semibold">Add Remark Field</div>
              <FormField
                label="Key"
                value={newRemark.key}
                onChange={(e) => setNewRemark({ ...newRemark, key: e.target.value })}
              />
              <FormField
                label="Label"
                value={newRemark.label}
                onChange={(e) => setNewRemark({ ...newRemark, label: e.target.value })}
              />
              <FormField
                label="Sort Order"
                value={newRemark.sort_order}
                onChange={(e) => setNewRemark({ ...newRemark, sort_order: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newRemark.is_active}
                  onChange={(e) => setNewRemark({ ...newRemark, is_active: e.target.checked })}
                />
                Active
              </label>
              <button
                type="button"
                onClick={handleCreateRemark}
                className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white"
              >
                Create Remark Field
              </button>
            </div>
          </AdminSection>
        )}
      </div>
    </MobileShell>
  );
}
