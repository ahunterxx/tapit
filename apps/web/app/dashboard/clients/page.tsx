import { requireAuthToken } from "@/lib/auth";
import { api } from "@/lib/api";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  stampsCount: number;
  goalValue: number;
  visitCount: number;
  deviceType: "APPLE" | "GOOGLE" | null;
  lastVisitAt: string | null;
  status: "active" | "at-risk" | "dormant" | "new";
}

interface ClientsResponse {
  clients: Client[];
  pagination: { total: number; page: number; totalPages: number };
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/20",
  "at-risk": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  dormant: "bg-red-500/10 text-red-400 border-red-500/20",
  new: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  const token = await requireAuthToken();
  const params = await searchParams;

  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", params.page);

  let data: ClientsResponse = { clients: [], pagination: { total: 0, page: 1, totalPages: 1 } };

  try {
    data = await api.get<ClientsResponse>(`/dashboard/clients?${qs}`, token);
  } catch {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.pagination.total} total members
          </p>
        </div>
      </div>

      <form className="flex gap-3">
        <Input
          name="search"
          defaultValue={params.search}
          placeholder="Search by name or phone..."
          className="max-w-xs"
        />
        <div className="flex gap-2">
          {["", "active", "at-risk", "dormant"].map((s) => (
            <Link
              key={s}
              href={`/dashboard/clients?${s ? `status=${s}` : ""}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                params.status === s || (!params.status && !s)
                  ? "bg-secondary text-foreground border-border"
                  : "text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </Link>
          ))}
        </div>
      </form>

      {data.clients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No clients yet. Share your QR code to get your first member.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stamps</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Visits</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Visit</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-border hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="font-medium hover:underline"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{client.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono">
                      {client.stampsCount}/{client.goalValue}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{client.visitCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {client.lastVisitAt
                      ? new Date(client.lastVisitAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[client.status]}`}
                    >
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
