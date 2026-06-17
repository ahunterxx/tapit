"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Send } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  sentAt: string;
  targetType: string;
  sentCount: number;
}

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [history, setHistory] = useState<Notification[]>([]);

  async function loadHistory() {
    try {
      const res = await fetch(`/api/proxy/dashboard/notifications`);
      const data = await res.json();
      setHistory(data.notifications ?? []);
    } catch {}
  }

  useEffect(() => { loadHistory(); }, []);

  async function sendNotification(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult("");
    try {
      const res = await fetch(`/api/proxy/dashboard/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, targetType: "ALL" }),
      });
      const data = await res.json();
      setResult(`Sent to ${data.sent} / ${data.total} clients`);
      setTitle("");
      setMessage("");
      loadHistory();
    } catch {
      setResult("Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send push notifications to your clients
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Send to All Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendNotification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Special offer this weekend!"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Come in Saturday for a free coffee with any service."
                required
                maxLength={500}
                rows={3}
              />
            </div>
            {result && (
              <p className="text-sm text-muted-foreground bg-secondary px-3 py-2 rounded-md">
                {result}
              </p>
            )}
            <Button type="submit" disabled={sending} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send Notification"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-medium mb-4">Sent History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((n) => (
              <div
                key={n.id}
                className="px-4 py-3 rounded-lg bg-card border border-border space-y-1"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {n.sentCount} sent
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(n.sentAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
