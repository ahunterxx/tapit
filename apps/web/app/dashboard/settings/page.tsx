import { requireAuthToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { QrCode, Link2, Smartphone } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

interface ProgramData {
  business: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    brandColor: string;
    qrCodeUrl: string | null;
  };
  program: {
    goalValue: number;
    rewardDescription: string;
    backgroundColor: string;
  } | null;
}

interface TapData {
  capabilities: { appleWallet: boolean; googleWallet: boolean };
}

export default async function SettingsPage() {
  const token = await requireAuthToken();

  let data: ProgramData | null = null;
  let caps = { appleWallet: false, googleWallet: false };

  try {
    data = await api.get<ProgramData>("/dashboard/program", token);
  } catch {}

  const tapUrl = data?.business.slug
    ? `${process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"}/tap/${data.business.slug}`
    : null;

  // Fetch live wallet capability status from the tap endpoint
  if (data?.business.slug) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const tapRes = await fetch(`${apiUrl}/tap/${data.business.slug}`, { cache: "no-store" });
      if (tapRes.ok) {
        const tapData: TapData = await tapRes.json();
        caps = tapData.capabilities;
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your business configuration and NFC/QR setup
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Your Tap URL
          </CardTitle>
          <CardDescription>
            This is the URL encoded in your QR code and NFC card
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tapUrl ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md">
                <code className="text-sm flex-1 truncate">{tapUrl}</code>
                <CopyButton text={tapUrl} />
              </div>
              <p className="text-xs text-muted-foreground">
                Program your NFC sticker with this URL using the NFC Tools app (iOS or Android).
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR Code
          </CardTitle>
          <CardDescription>
            Print and display this QR code at your checkout counter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.business.qrCodeUrl ? (
            <div className="space-y-3">
              <img
                src={data.business.qrCodeUrl}
                alt="QR Code"
                className="w-40 h-40 rounded-lg border border-border bg-white p-2"
              />
              <a
                href={data.business.qrCodeUrl}
                download="qr-code.png"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Download PNG
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">QR code not generated yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Wallet Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Google Wallet</p>
              <p className="text-xs text-muted-foreground">Android devices</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full border ${
                caps.googleWallet
                  ? "text-green-500 border-green-500/30 bg-green-500/10"
                  : "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"
              }`}
            >
              {caps.googleWallet ? "Active" : "Not configured"}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Apple Wallet</p>
              <p className="text-xs text-muted-foreground">Requires Apple Developer Account ($99/year)</p>
            </div>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full border ${
                caps.appleWallet
                  ? "text-green-500 border-green-500/30 bg-green-500/10"
                  : "text-yellow-500 border-yellow-500/30 bg-yellow-500/10"
              }`}
            >
              {caps.appleWallet ? "Active" : "Not configured"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
