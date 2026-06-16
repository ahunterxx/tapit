import { requireAuthToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Stamp, Gift, AlertTriangle } from "lucide-react";

interface OverviewStats {
  stats: {
    totalClients: number;
    activeThisMonth: number;
    stampsToday: number;
    totalVisits: number;
    redemptions: number;
    atRisk: number;
  };
  recentActivity: Array<{
    id: string;
    clientName: string;
    clientPhone: string | null;
    stampsAdded: number;
    timestamp: string;
  }>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const token = await requireAuthToken();

  let data: OverviewStats | null = null;
  try {
    data = await api.get<OverviewStats>("/dashboard/overview", token);
  } catch {
    // If API is down, show empty state
  }

  const stats = data?.stats;
  const recent = data?.recentActivity ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your loyalty program at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={stats?.totalClients ?? 0}
          icon={Users}
          sub="All enrolled clients"
        />
        <StatCard
          title="Active This Month"
          value={stats?.activeThisMonth ?? 0}
          icon={TrendingUp}
          sub="Visited in last 30 days"
        />
        <StatCard
          title="Stamps Today"
          value={stats?.stampsToday ?? 0}
          icon={Stamp}
          sub="Given so far today"
        />
        <StatCard
          title="Rewards Redeemed"
          value={stats?.redemptions ?? 0}
          icon={Gift}
          sub="Total redemptions"
        />
      </div>

      {(stats?.atRisk ?? 0) > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{stats?.atRisk}</strong> clients haven&apos;t visited in 30+ days — consider
            sending a win-back notification.
          </span>
        </div>
      )}

      <div>
        <h2 className="text-base font-medium mb-4">Recent Activity</h2>
        {recent.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No activity yet. Clients will appear here after their first tap.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-card border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                    {activity.clientName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.clientName}</p>
                    {activity.clientPhone && (
                      <p className="text-xs text-muted-foreground">{activity.clientPhone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {activity.stampsAdded > 0 && (
                    <p className="text-sm font-medium text-foreground">
                      +{activity.stampsAdded} stamp{activity.stampsAdded > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
