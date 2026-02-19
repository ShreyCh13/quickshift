"use client";
import { useEffect, useState } from "react";
import { getSessionHeader } from "@/lib/auth";

interface DebugData {
  message: string;
  sessionInfo: {
    userId: string;
    userName: string;
    role: string;
  };
  counts: {
    vehicles: number;
    inspections: number;
    maintenance: number;
    users: number;
  };
  errors: Record<string, string | null>;
  latestInspections: Array<{ id: string; vehicle_id: string; created_at: string }>;
  latestMaintenance: Array<{ id: string; vehicle_id: string; created_at: string }>;
  apiTests: {
    maintenance: { success: boolean; count: number; error?: string; firstRecord?: string };
    inspections: { success: boolean; count: number; error?: string; firstRecord?: string };
  };
}

export default function DebugPage() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenanceApiResult, setMaintenanceApiResult] = useState<string>("");
  const [inspectionsApiResult, setInspectionsApiResult] = useState<string>("");

  useEffect(() => {
    // Pass session header to test auth
    const headers = getSessionHeader();
    
    fetch("/api/debug", { headers })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d?.error || "Forbidden"); });
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });

    // Also test the actual API endpoints
    fetch("/api/events/maintenance?page=1&pageSize=5", { headers })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setMaintenanceApiResult(`❌ Error: ${d.error}`);
        } else {
          setMaintenanceApiResult(`✅ Got ${d.maintenance?.length || 0} records (total: ${d.total || 0})`);
        }
      })
      .catch((e) => setMaintenanceApiResult(`❌ Fetch failed: ${e.message}`));

    fetch("/api/events/inspections?page=1&pageSize=5", { headers })
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setInspectionsApiResult(`❌ Error: ${d.error}`);
        } else {
          setInspectionsApiResult(`✅ Got ${d.inspections?.length || 0} records (total: ${d.total || 0})`);
        }
      })
      .catch((e) => setInspectionsApiResult(`❌ Fetch failed: ${e.message}`));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  const hasErrors = data && Object.values(data.errors).some((e) => e !== null);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Database Debug</h1>
          <p className="text-gray-600 mb-6">This page shows what&apos;s in your database.</p>

          {/* Session Status */}
          <div className="rounded-lg p-4 mb-6 bg-green-50 border border-green-200">
            <h2 className="font-bold mb-2">Session Status</h2>
            <p>User: <strong>{data?.sessionInfo?.userName}</strong></p>
            <p>Role: <strong>{data?.sessionInfo?.role}</strong></p>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600">{data?.counts.vehicles}</div>
              <div className="text-gray-600">Vehicles</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600">{data?.counts.inspections}</div>
              <div className="text-gray-600">Inspections</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-purple-600">{data?.counts.maintenance}</div>
              <div className="text-gray-600">Maintenance</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-600">{data?.counts.users}</div>
              <div className="text-gray-600">Users</div>
            </div>
          </div>

          {/* Direct Database Query Tests */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="font-bold mb-2">Direct Database Query</h2>
            <div className="space-y-2 text-sm">
              <div className={`p-2 rounded ${data?.apiTests?.maintenance?.success ? 'bg-green-100' : 'bg-red-100'}`}>
                <strong>Maintenance:</strong> {data?.apiTests?.maintenance?.success ? '✓ Working' : '✗ Failed'}
                {data?.apiTests?.maintenance?.count !== undefined && ` - ${data.apiTests.maintenance.count} records`}
                {data?.apiTests?.maintenance?.error && <span className="text-red-600"> - {data.apiTests.maintenance.error}</span>}
              </div>
              <div className={`p-2 rounded ${data?.apiTests?.inspections?.success ? 'bg-green-100' : 'bg-red-100'}`}>
                <strong>Inspections:</strong> {data?.apiTests?.inspections?.success ? '✓ Working' : '✗ Failed'}
                {data?.apiTests?.inspections?.count !== undefined && ` - ${data.apiTests.inspections.count} records`}
                {data?.apiTests?.inspections?.error && <span className="text-red-600"> - {data.apiTests.inspections.error}</span>}
              </div>
            </div>
          </div>

          {/* Actual API Endpoint Tests */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="font-bold mb-2">API Endpoint Tests (what the app uses)</h2>
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded bg-white">
                <strong>/api/events/maintenance:</strong> {maintenanceApiResult || "Testing..."}
              </div>
              <div className="p-2 rounded bg-white">
                <strong>/api/events/inspections:</strong> {inspectionsApiResult || "Testing..."}
              </div>
            </div>
          </div>

          {/* Errors */}
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h2 className="font-bold text-red-600 mb-2">Errors Found:</h2>
              {Object.entries(data?.errors || {}).map(([key, val]) =>
                val ? (
                  <p key={key} className="text-red-500 text-sm">
                    {key}: {val}
                  </p>
                ) : null
              )}
            </div>
          )}

          {/* Latest Records */}
          <div className="space-y-4">
            <div>
              <h2 className="font-bold text-gray-800 mb-2">Latest 5 Inspections:</h2>
              {data?.latestInspections.length === 0 ? (
                <p className="text-gray-500 italic">No inspections found</p>
              ) : (
                <ul className="space-y-1">
                  {data?.latestInspections.map((i) => (
                    <li key={i.id} className="text-sm bg-gray-50 p-2 rounded">
                      ID: {i.id.slice(0, 8)}... | Created: {new Date(i.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="font-bold text-gray-800 mb-2">Latest 5 Maintenance:</h2>
              {data?.latestMaintenance.length === 0 ? (
                <p className="text-gray-500 italic">No maintenance found</p>
              ) : (
                <ul className="space-y-1">
                  {data?.latestMaintenance.map((m) => (
                    <li key={m.id} className="text-sm bg-gray-50 p-2 rounded">
                      ID: {m.id.slice(0, 8)}... | Created: {new Date(m.created_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <a href="/" className="text-blue-600 underline">← Back to Home</a>
        </div>
      </div>
    </div>
  );
}
