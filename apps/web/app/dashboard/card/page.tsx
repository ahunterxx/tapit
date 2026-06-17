"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProgramData {
  business: { name: string; brandColor: string };
  program: {
    goalValue: number;
    rewardDescription: string;
    backgroundColor: string;
    foregroundColor: string;
    labelColor: string;
  } | null;
}

function WalletPreview({
  businessName,
  stamps,
  goal,
  reward,
  bgColor,
  fgColor,
}: {
  businessName: string;
  stamps: number;
  goal: number;
  reward: string;
  bgColor: string;
  fgColor: string;
}) {
  return (
    <div
      className="w-full max-w-xs rounded-2xl p-5 shadow-2xl"
      style={{ backgroundColor: bgColor, color: fgColor }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-medium opacity-50 uppercase tracking-wider">STAMPS</p>
          <p className="text-2xl font-bold font-mono mt-0.5">{stamps} / {goal}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium opacity-50 uppercase tracking-wider">REWARD</p>
          <p className="text-sm font-medium mt-0.5">{reward}</p>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-4">
        {Array.from({ length: Math.min(goal, 10) }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-md flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: i < stamps ? fgColor : `${fgColor}15`,
              color: i < stamps ? bgColor : `${fgColor}40`,
            }}
          >
            {i < stamps ? "✓" : ""}
          </div>
        ))}
      </div>
      <p className="text-xs font-medium opacity-50 uppercase tracking-wider">MEMBER</p>
      <p className="text-sm font-medium mt-0.5">{businessName} Loyalty</p>
    </div>
  );
}

export default function CardDesignPage() {
  const [data, setData] = useState<ProgramData | null>(null);
  const [goalValue, setGoalValue] = useState(10);
  const [reward, setReward] = useState("");
  const [bgColor, setBgColor] = useState("#0a0a0a");
  const [fgColor, setFgColor] = useState("#ffffff");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await fetch(`/api/proxy/dashboard/program`);
    if (!res.ok) return;
    const d: ProgramData = await res.json();
    setData(d);
    if (d.program) {
      setGoalValue(d.program.goalValue);
      setReward(d.program.rewardDescription);
      setBgColor(d.program.backgroundColor);
      setFgColor(d.program.foregroundColor);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/proxy/dashboard/program`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalValue, rewardDescription: reward, backgroundColor: bgColor, foregroundColor: fgColor }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Card Design</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how your loyalty card looks in Apple/Google Wallet
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Live preview */}
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Preview</p>
          <WalletPreview
            businessName={data?.business.name ?? "Your Business"}
            stamps={3}
            goal={goalValue}
            reward={reward || "Free reward"}
            bgColor={bgColor}
            fgColor={fgColor}
          />
        </div>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Card Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Stamp Goal</Label>
                <Input
                  id="goal"
                  type="number"
                  min={1}
                  max={50}
                  value={goalValue}
                  onChange={(e) => setGoalValue(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  How many stamps before the client earns their reward
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward">Reward Description</Label>
                <Input
                  id="reward"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  placeholder="e.g. Free haircut"
                  maxLength={100}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bg">Background Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="bg"
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fg">Text Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="fg"
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saved ? "Saved!" : saving ? "Saving..." : "Save Design"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
