"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Business {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  isActive: boolean;
  createdAt: string;
  _count: { clients: number };
}

function useAdminSecret() {
  const [secret, setSecret] = useState<string>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("admin-secret") ?? "" : ""
  );
  const save = (s: string) => {
    sessionStorage.setItem("admin-secret", s);
    setSecret(s);
  };
  return [secret, save] as const;
}

function adminHeaders(secret: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-admin-secret": secret };
}

export default function AdminPage() {
  const [secret, setSecret] = useAdminSecret();
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    name: "", slug: "", ownerEmail: "", ownerPassword: "",
    brandColor: "#0a0a0a", goalValue: 10, rewardDescription: "Free reward",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function verify(s: string) {
    setLoading(true);
    setError("");
    const res = await fetch(`${API}/admin/businesses`, { headers: adminHeaders(s) });
    if (res.ok) {
      const data: Business[] = await res.json();
      setSecret(s);
      setAuthed(true);
      setBusinesses(data);
    } else {
      setError("Wrong admin secret.");
    }
    setLoading(false);
  }

  async function loadBusinesses() {
    const res = await fetch(`${API}/admin/businesses`, { headers: adminHeaders(secret) });
    if (res.ok) setBusinesses(await res.json());
  }

  async function toggle(id: string) {
    await fetch(`${API}/admin/businesses/${id}/toggle`, {
      method: "PATCH",
      headers: adminHeaders(secret),
    });
    loadBusinesses();
  }

  async function createBusiness(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    const res = await fetch(`${API}/admin/businesses`, {
      method: "POST",
      headers: adminHeaders(secret),
      body: JSON.stringify({ ...form, goalValue: Number(form.goalValue) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCreateError(data.error ?? "Failed to create business");
    } else {
      setShowCreate(false);
      setForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "", brandColor: "#0a0a0a", goalValue: 10, rewardDescription: "Free reward" });
      loadBusinesses();
    }
    setCreating(false);
  }

  useEffect(() => {
    if (secret) verify(secret);
  }, []);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); verify(input); }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Admin Secret</Label>
                <Input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter admin secret"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking..." : "Enter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {businesses.length} business{businesses.length !== 1 ? "es" : ""} registered
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setAuthed(false); sessionStorage.removeItem("admin-secret"); }}
            >
              Sign out
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-4 h-4 mr-2" />
              New Business
            </Button>
          </div>
        </div>

        {/* Create business form */}
        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create Business Account</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createBusiness} className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Cairo Cuts Barbershop"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                    placeholder="cairo-cuts"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Email</Label>
                  <Input
                    type="email"
                    value={form.ownerEmail}
                    onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
                    placeholder="owner@business.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Password</Label>
                  <Input
                    type="password"
                    value={form.ownerPassword}
                    onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reward Description</Label>
                  <Input
                    value={form.rewardDescription}
                    onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
                    placeholder="Free haircut"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stamp Goal</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.goalValue}
                    onChange={(e) => setForm({ ...form, goalValue: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.brandColor}
                      onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer bg-transparent"
                    />
                    <Input
                      value={form.brandColor}
                      onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                      className="font-mono text-xs"
                      maxLength={7}
                    />
                  </div>
                </div>
                {createError && (
                  <p className="col-span-2 text-sm text-destructive">{createError}</p>
                )}
                <div className="col-span-2 flex gap-3">
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create Business"}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Businesses list */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Business</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Members</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{b.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.ownerEmail}</td>
                  <td className="px-4 py-3 font-mono">{b._count.clients}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        b.isActive
                          ? "text-green-500 border-green-500/30 bg-green-500/10"
                          : "text-red-500 border-red-500/30 bg-red-500/10"
                      }`}
                    >
                      {b.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggle(b.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={b.isActive ? "Disable" : "Enable"}
                      >
                        {b.isActive
                          ? <ToggleRight className="w-5 h-5 text-green-500" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>
                      <a
                        href={`/tap/${b.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="View tap page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {businesses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No businesses yet. Create the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
