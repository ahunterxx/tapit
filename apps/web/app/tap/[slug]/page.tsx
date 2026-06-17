"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface TapData {
  business: { id: string; name: string; slug: string; logoUrl: string | null; brandColor: string };
  loyaltyProgram: {
    goalValue: number;
    rewardDescription: string;
    backgroundColor: string;
    foregroundColor: string;
  } | null;
  capabilities: { appleWallet: boolean; googleWallet: boolean };
}

interface CheckinResult {
  status: "stamped" | "enrolled" | "needs_name" | "already_stamped" | "reward_ready";
  clientName?: string;
  stampsCount?: number;
  goalValue?: number;
  rewardDescription?: string;
  googleWalletLink?: string;
  applePassUrl?: string;
  nextStampAt?: string;
}

type Step = "loading" | "error" | "phone" | "name" | "processing" | "done";

function detectDevice(): "iOS" | "Android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  return "other";
}

function StampGrid({ count, goal, fg }: { count: number; goal: number; fg: string }) {
  const display = Math.min(goal, 10);
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: display }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all"
          style={
            i < count
              ? { backgroundColor: fg, borderColor: fg, color: "var(--bg)" }
              : { borderColor: `${fg}30`, color: `${fg}25` }
          }
        >
          {i < count ? "✓" : ""}
        </div>
      ))}
    </div>
  );
}

export default function TapPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tapData, setTapData] = useState<TapData | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<CheckinResult | null>(null);
  const device = detectDevice();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/tap/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d: TapData) => {
        setTapData(d);
        setStep("phone");
      })
      .catch(() => {
        setErrorMsg("This loyalty card doesn't exist.");
        setStep("error");
      });
  }, [slug]);

  async function checkin(withName?: string) {
    setStep("processing");
    const deviceType = device === "iOS" ? "APPLE" : device === "Android" ? "GOOGLE" : "NONE";

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tap/${slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: withName?.trim(), deviceType }),
      });

      const data: CheckinResult = await res.json();

      if (data.status === "needs_name") {
        setStep("name");
        return;
      }

      setResult(data);

      // Auto-redirect Apple pass download
      if (data.applePassUrl && device === "iOS") {
        window.location.href = data.applePassUrl;
        return;
      }

      // Auto-redirect Google Wallet on Android
      if (data.googleWalletLink && device === "Android") {
        window.location.href = data.googleWalletLink;
        return;
      }

      setStep("done");
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setStep("phone");
    }
  }

  const bg = tapData?.loyaltyProgram?.backgroundColor ?? tapData?.business.brandColor ?? "#0a0a0a";
  const fg = tapData?.loyaltyProgram?.foregroundColor ?? "#ffffff";
  const goal = result?.goalValue ?? tapData?.loyaltyProgram?.goalValue ?? 10;
  const stamps = result?.stampsCount ?? 0;

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-center px-6">
        <p className="text-base opacity-60">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ backgroundColor: bg, color: fg, ["--bg" as string]: bg }}
    >
      {/* Business header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        {tapData?.business.logoUrl ? (
          <img src={tapData.business.logoUrl} alt={tapData.business.name} className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: `${fg}15`, color: fg }}>
            {tapData?.business.name[0]}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight" style={{ color: fg }}>{tapData?.business.name}</h1>
          <p className="text-xs mt-0.5 opacity-50" style={{ color: fg }}>Loyalty Card</p>
        </div>
      </div>

      {/* Done: stamped or reward */}
      {step === "done" && result && (
        <div className="w-full max-w-xs text-center space-y-6">
          {result.status === "already_stamped" ? (
            <>
              <div className="text-4xl">⏳</div>
              <div>
                <p className="text-lg font-semibold" style={{ color: fg }}>Already stamped!</p>
                <p className="text-sm opacity-60 mt-1" style={{ color: fg }}>
                  Come back after{" "}
                  {result.nextStampAt
                    ? new Date(result.nextStampAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "a few hours"}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
                <p className="text-xs opacity-50 mb-2" style={{ color: fg }}>Current stamps</p>
                <StampGrid count={result.stampsCount ?? 0} goal={goal} fg={fg} />
                <p className="text-xs opacity-40 mt-2" style={{ color: fg }}>
                  {result.stampsCount} / {goal} — {result.rewardDescription}
                </p>
              </div>
            </>
          ) : result.status === "reward_ready" ? (
            <>
              <div className="text-5xl">🎉</div>
              <div>
                <p className="text-lg font-semibold" style={{ color: fg }}>Reward unlocked!</p>
                <p className="text-sm opacity-70 mt-1" style={{ color: fg }}>
                  You earned: <strong>{result.rewardDescription}</strong>
                </p>
                <p className="text-xs opacity-50 mt-1" style={{ color: fg }}>Show this to the staff</p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
                <StampGrid count={stamps} goal={goal} fg={fg} />
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl">✓</div>
              <div>
                <p className="text-lg font-semibold" style={{ color: fg }}>
                  {result.status === "enrolled" ? `Welcome, ${result.clientName}!` : `Stamped, ${result.clientName}!`}
                </p>
                <p className="text-sm opacity-60 mt-1" style={{ color: fg }}>
                  {stamps} / {goal} stamps — {result.rewardDescription}
                </p>
              </div>
              <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
                <StampGrid count={stamps} goal={goal} fg={fg} />
              </div>
              {/* Wallet button for desktop/non-auto-redirect cases */}
              {result.googleWalletLink && device !== "Android" && (
                <a
                  href={result.googleWalletLink}
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: fg, color: bg }}
                >
                  Add to Google Wallet
                </a>
              )}
            </>
          )}
        </div>
      )}

      {/* Processing spinner */}
      {step === "processing" && (
        <div className="flex items-center gap-2 text-sm opacity-60" style={{ color: fg }}>
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${fg}40`, borderTopColor: fg }} />
          Checking in...
        </div>
      )}

      {/* Name entry (new customer) */}
      {step === "name" && (
        <div className="w-full max-w-xs space-y-4">
          <p className="text-center text-sm opacity-70" style={{ color: fg }}>
            Welcome! What&apos;s your name?
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && checkin(name)}
          />
          <button
            onClick={() => checkin(name)}
            disabled={!name.trim()}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: fg, color: bg }}
          >
            Get My First Stamp
          </button>
        </div>
      )}

      {/* Phone entry (default) */}
      {step === "phone" && (
        <div className="w-full max-w-xs space-y-4">
          {/* Stamp preview */}
          <div className="rounded-2xl p-4 mb-2" style={{ backgroundColor: `${fg}08`, border: `1px solid ${fg}20` }}>
            <div className="flex justify-between text-xs opacity-50 mb-3" style={{ color: fg }}>
              <span>STAMPS</span>
              <span>0 / {tapData?.loyaltyProgram?.goalValue ?? "?"}</span>
            </div>
            <StampGrid count={0} goal={tapData?.loyaltyProgram?.goalValue ?? 10} fg={fg} />
            <p className="text-xs opacity-40 mt-2 text-center" style={{ color: fg }}>
              Reward: {tapData?.loyaltyProgram?.rewardDescription ?? "Free reward"}
            </p>
          </div>

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && phone.trim().length >= 6 && checkin()}
          />

          <button
            onClick={() => checkin()}
            disabled={phone.trim().length < 6}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: fg, color: bg }}
          >
            Check In & Get Stamp
          </button>

          <p className="text-xs text-center opacity-30" style={{ color: fg }}>
            No app needed · Your card lives in your phone&apos;s Wallet
          </p>
        </div>
      )}
    </div>
  );
}
