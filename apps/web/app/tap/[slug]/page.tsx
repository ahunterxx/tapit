"use client";
import { useEffect, useState, useCallback } from "react";
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

interface StampResult {
  status: "stamped" | "enrolled" | "needs_name" | "reward_ready";
  clientId?: string;
  clientName?: string;
  stampsCount?: number;
  goalValue?: number;
  rewardDescription?: string;
  googleWalletLink?: string;
  applePassUrl?: string;
}

type Step = "loading" | "error" | "auto_stamping" | "phone" | "name" | "processing" | "done";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function detectDevice(): "iOS" | "Android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  return "other";
}

function StampGrid({ count, goal, fg }: { count: number; goal: number; fg: string }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: Math.min(goal, 10) }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-bold"
          style={
            i < count
              ? { backgroundColor: fg, borderColor: fg, color: "#000" }
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
  const [result, setResult] = useState<StampResult | null>(null);
  const device = detectDevice();

  const localKey = `tapit_${slug}`;

  const finishWithResult = useCallback((data: StampResult) => {
    // Save clientId so next scan is instant (no typing needed)
    if (data.clientId) {
      localStorage.setItem(localKey, data.clientId);
    }
    setResult(data);

    // Auto-redirect wallet on mobile
    if (data.applePassUrl && device === "iOS") {
      window.location.href = data.applePassUrl;
      return;
    }
    if (data.googleWalletLink && device === "Android") {
      window.location.href = data.googleWalletLink;
      return;
    }

    setStep("done");
  }, [device, localKey]);

  // Auto-stamp returning customer by stored clientId
  const autoStamp = useCallback(async (clientId: string) => {
    setStep("auto_stamping");
    try {
      const res = await fetch(`${API}/tap/${slug}/stamp-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const data: StampResult = await res.json();
      if (!res.ok) {
        // ClientId no longer valid — clear and show phone form
        localStorage.removeItem(localKey);
        setStep("phone");
        return;
      }
      finishWithResult(data);
    } catch {
      localStorage.removeItem(localKey);
      setStep("phone");
    }
  }, [slug, localKey, finishWithResult]);

  useEffect(() => {
    fetch(`${API}/tap/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d: TapData) => {
        setTapData(d);
        const storedId = localStorage.getItem(`tapit_${slug}`);
        if (storedId) {
          autoStamp(storedId);
        } else {
          setStep("phone");
        }
      })
      .catch(() => {
        setErrorMsg("This loyalty card doesn't exist.");
        setStep("error");
      });
  }, [slug, autoStamp]);

  async function checkin(withName?: string) {
    setStep("processing");
    const deviceType = device === "iOS" ? "APPLE" : device === "Android" ? "GOOGLE" : "NONE";
    try {
      const res = await fetch(`${API}/tap/${slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: withName?.trim(), deviceType }),
      });
      const data: StampResult = await res.json();
      if (data.status === "needs_name") {
        setStep("name");
        return;
      }
      finishWithResult(data);
    } catch {
      setErrorMsg("Something went wrong. Try again.");
      setStep("phone");
    }
  }

  const bg = tapData?.loyaltyProgram?.backgroundColor ?? tapData?.business.brandColor ?? "#0a0a0a";
  const fg = tapData?.loyaltyProgram?.foregroundColor ?? "#ffffff";
  const goal = result?.goalValue ?? tapData?.loyaltyProgram?.goalValue ?? 10;
  const stamps = result?.stampsCount ?? 0;

  if (step === "loading" || step === "auto_stamping") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: bg }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        {step === "auto_stamping" && (
          <p className="text-sm opacity-50" style={{ color: fg }}>Adding your stamp…</p>
        )}
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
      style={{ backgroundColor: bg, color: fg }}
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

      {/* Done screen */}
      {step === "done" && result && (
        <div className="w-full max-w-xs text-center space-y-6">
          {result.status === "reward_ready" ? (
            <>
              <div className="text-5xl">🎉</div>
              <div>
                <p className="text-lg font-semibold" style={{ color: fg }}>Reward unlocked!</p>
                <p className="text-sm opacity-70 mt-1" style={{ color: fg }}>
                  You earned: <strong>{result.rewardDescription}</strong>
                </p>
                <p className="text-xs opacity-50 mt-1" style={{ color: fg }}>Show this to the staff</p>
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
                  {stamps} / {goal} stamps
                </p>
              </div>
            </>
          )}

          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
            <StampGrid count={stamps} goal={goal} fg={fg} />
            <p className="text-xs opacity-40 mt-2 text-center" style={{ color: fg }}>
              {result.rewardDescription}
            </p>
          </div>

          {result.googleWalletLink && device !== "Android" && (
            <a
              href={result.googleWalletLink}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: fg, color: bg }}
            >
              Add to Google Wallet
            </a>
          )}
        </div>
      )}

      {/* Processing */}
      {step === "processing" && (
        <div className="flex items-center gap-2 text-sm opacity-60" style={{ color: fg }}>
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${fg}40`, borderTopColor: fg }} />
          Setting up your card…
        </div>
      )}

      {/* Name entry — new customer */}
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
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}
          >
            Get My First Stamp
          </button>
        </div>
      )}

      {/* Phone entry — first-time visitor */}
      {step === "phone" && (
        <div className="w-full max-w-xs space-y-4">
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

          <p className="text-center text-sm opacity-60" style={{ color: fg }}>
            First visit? Enter your phone to join.
          </p>

          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && phone.trim().length >= 6 && checkin()}
          />

          <button
            onClick={() => checkin()}
            disabled={phone.trim().length < 6}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}
          >
            Join & Get First Stamp
          </button>

          <p className="text-xs text-center opacity-30" style={{ color: fg }}>
            Next time you scan, it&apos;s automatic — no typing needed.
          </p>
        </div>
      )}
    </div>
  );
}
