"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Campaign {
  id: string;
  type: "WIN_BACK" | "BIRTHDAY" | "REWARD_READY" | "CUSTOM";
  triggerDays: number | null;
  isActive: boolean;
  message: string;
}

const labels: Record<string, { title: string; description: string }> = {
  WIN_BACK: { title: "Win-back Campaign", description: "Re-engage clients who haven't visited in a while" },
  REWARD_READY: { title: "Almost There!", description: "Notify clients who are 1 stamp away from their reward" },
  BIRTHDAY: { title: "Birthday Reward", description: "Send a special message on clients' birthdays" },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/proxy/dashboard/campaigns`);
    const data = await res.json();
    setCampaigns(data);
  }

  useEffect(() => { load(); }, []);

  async function toggle(id: string) {
    await fetch(`/api/proxy/dashboard/campaigns/${id}/toggle`, { method: "PATCH" });
    load();
  }

  async function saveMessage(id: string) {
    setSaving(true);
    await fetch(`/api/proxy/dashboard/campaigns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editMsg }),
    });
    setEditing(null);
    setSaving(false);
    load();
  }

  // Group WIN_BACK campaigns separately since there may be multiple (30-day, 60-day)
  const winBackCampaigns = campaigns.filter((c) => c.type === "WIN_BACK");
  const otherCampaigns = campaigns.filter((c) => c.type !== "WIN_BACK");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automated messages sent to your clients
        </p>
      </div>

      {winBackCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Win-back Campaigns</CardTitle>
            <CardDescription>Automatically message clients who haven&apos;t visited recently</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {winBackCampaigns.map((c) => (
              <div key={c.id} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                <Switch checked={c.isActive} onCheckedChange={() => toggle(c.id)} />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    After {c.triggerDays} days of inactivity
                  </p>
                  {editing === c.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editMsg}
                        onChange={(e) => setEditMsg(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveMessage(c.id)} disabled={saving}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {c.message}{" "}
                      <button
                        onClick={() => { setEditing(c.id); setEditMsg(c.message); }}
                        className="underline text-foreground ml-1"
                      >
                        Edit
                      </button>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {otherCampaigns.map((c) => {
        const meta = labels[c.type] ?? { title: c.type, description: "" };
        return (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{meta.title}</CardTitle>
                  <CardDescription className="mt-0.5">{meta.description}</CardDescription>
                </div>
                <Switch checked={c.isActive} onCheckedChange={() => toggle(c.id)} />
              </div>
            </CardHeader>
            <CardContent>
              {editing === c.id ? (
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={editMsg}
                    onChange={(e) => setEditMsg(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveMessage(c.id)} disabled={saving}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {c.message}{" "}
                  <button
                    onClick={() => { setEditing(c.id); setEditMsg(c.message); }}
                    className="underline text-foreground"
                  >
                    Edit
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
