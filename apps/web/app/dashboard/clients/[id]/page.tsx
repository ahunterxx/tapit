"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Smartphone, Plus, Gift, ArrowLeft, Clock } from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  deviceType: "APPLE" | "GOOGLE" | null;
  stampsCount: number;
  enrolledAt: string;
  lastVisitAt: string | null;
  visits: Array<{ id: string; timestamp: string; stampsAdded: number }>;
  business: {
    name: string;
    loyaltyProgram: {
      goalValue: number;
      rewardDescription: string;
    } | null;
  };
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [stamping, setStamping] = useState(false);
  const [message, setMessage] = useState("");

  async function loadClient() {
    try {
      const res = await fetch(`/api/proxy/dashboard/clients/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setClient(data);
    } catch {
      setMessage("Failed to load client");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClient(); }, [id]);

  async function addStamp() {
    if (!client) return;
    setStamping(true);
    setMessage("");
    try {
      const res = await fetch(`/api/proxy/dashboard/clients/${id}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      const data = await res.json();
      setMessage(data.message);
      await loadClient();
    } catch {
      setMessage("Failed to add stamp");
    } finally {
      setStamping(false);
    }
  }

  async function redeemReward() {
    if (!client) return;
    const res = await fetch(`/api/proxy/dashboard/clients/${id}/redeem`, {
      method: "POST",
    });
    const data = await res.json();
    setMessage(data.message);
    await loadClient();
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm animate-pulse">Loading...</div>;
  }

  if (!client) {
    return <div className="text-destructive text-sm">Client not found.</div>;
  }

  const program = client.business.loyaltyProgram;
  const goal = program?.goalValue ?? 10;
  const progress = Math.min(100, (client.stampsCount / goal) * 100);
  const rewardReady = client.stampsCount >= goal;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.phone ?? "No phone"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stamp Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Loyalty Stamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-medium">
                  {client.stampsCount} / {goal}
                </span>
              </div>
              <Progress value={progress} className="h-3" />
              {program && (
                <p className="text-xs text-muted-foreground">
                  Reward: {program.rewardDescription}
                </p>
              )}
            </div>

            {/* Stamp grid visual */}
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: goal }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-lg border-2 flex items-center justify-center text-xs transition-all ${
                    i < client.stampsCount
                      ? "bg-foreground border-foreground text-background font-bold"
                      : "border-border text-muted-foreground/30"
                  }`}
                >
                  {i < client.stampsCount ? "✓" : i + 1}
                </div>
              ))}
            </div>

            {message && (
              <div className="text-sm px-3 py-2 rounded-md bg-secondary text-foreground">
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={addStamp}
                disabled={stamping || rewardReady}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                {stamping ? "Adding..." : "Add Stamp"}
              </Button>
              {rewardReady && (
                <Button onClick={redeemReward} variant="outline" className="flex-1">
                  <Gift className="w-4 h-4 mr-2" />
                  Redeem Reward
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Client info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device</span>
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  {client.deviceType ?? "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrolled</span>
                <span>{new Date(client.enrolledAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Visit</span>
                <span>
                  {client.lastVisitAt
                    ? new Date(client.lastVisitAt).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Visits</span>
                <span>{client.visits.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Visit history */}
      <div>
        <h2 className="text-base font-medium mb-3">Visit History</h2>
        {client.visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No visits recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {client.visits.map((visit) => (
              <div
                key={visit.id}
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-card border border-border text-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(visit.timestamp).toLocaleString()}
                </div>
                {visit.stampsAdded > 0 && (
                  <span className="text-xs font-medium bg-secondary px-2 py-0.5 rounded">
                    +{visit.stampsAdded} stamp{visit.stampsAdded > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
