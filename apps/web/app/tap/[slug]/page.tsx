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

// loading    → fetching business info
// ready      → returning customer: show "Tap to Add Stamp" button
// phone      → new customer: enter phone
// name       → new customer: enter name
// stamping   → API call in flight
// done       → success
// error      → business not found
type Step = "loading" | "ready" | "phone" | "name" | "stamping" | "done" | "error";

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
          className="aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all"
          style={
            i < count
              ? { backgroundColor: fg, borderColor: fg, color: "#000" }
              : { borderColor: `${fg}25`, color: `${fg}20` }
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
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState<StampResult | null>(null);
  const [storedClientId, setStoredClientId] = useState<string | null>(null);
  const device = detectDevice();
  const localKey = `tapit_${slug}`;

  useEffect(() => {
    fetch(`${API}/tap/${slug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: TapData) => {
        setTapData(d);
        const saved = localStorage.getItem(localKey);
        if (saved) {
          setStoredClientId(saved);
          setStep("ready"); // show Tap to Stamp button — do NOT auto-stamp
        } else {
          setStep("phone");
        }
      })
      .catch(() => setStep("error"));
  }, [slug, localKey]);

  const handleResult = useCallback((data: StampResult) => {
    if (data.clientId) localStorage.setItem(localKey, data.clientId);
    setResult(data);

    if (data.applePassUrl && device === "iOS") { window.location.href = data.applePassUrl; return; }
    if (data.googleWalletLink && device === "Android") { window.location.href = data.googleWalletLink; return; }

    setStep("done");
  }, [device, localKey]);

  // Called when the "Tap to Add Stamp" button is pressed
  async function addStamp() {
    if (!storedClientId) return;
    setStep("stamping");
    try {
      const res = await fetch(`${API}/tap/${slug}/stamp-by-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: storedClientId }),
      });
      const data: StampResult = await res.json();
      if (!res.ok) {
        // Stored ID is no longer valid (client deleted etc.) — fall back to phone form
        localStorage.removeItem(localKey);
        setStoredClientId(null);
        setStep("phone");
        return;
      }
      handleResult(data);
    } catch {
      setStep("ready");
    }
  }

  // Called on phone form submit
  async function checkin(withName?: string) {
    setStep("stamping");
    const deviceType = device === "iOS" ? "APPLE" : device === "Android" ? "GOOGLE" : "NONE";
    try {
      const res = await fetch(`${API}/tap/${slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: withName?.trim(), deviceType }),
      });
      const data: StampResult = await res.json();
      if (data.status === "needs_name") { setStep("name"); return; }
      handleResult(data);
    } catch {
      setStep("phone");
    }
  }

  const bg = tapData?.loyaltyProgram?.backgroundColor ?? tapData?.business.brandColor ?? "#0a0a0a";
  const fg = tapData?.loyaltyProgram?.foregroundColor ?? "#ffffff";
  const goal = result?.goalValue ?? tapData?.loyaltyProgram?.goalValue ?? 10;
  const stamps = result?.stampsCount ?? 0;

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-center px-6">
        <p className="opacity-50">This loyalty card doesn&apos;t exist.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ backgroundColor: bg, color: fg }}>

      {/* Business header */}
      <div className="mb-8 flex flex-col items-center gap-3">
        {tapData?.business.logoUrl ? (
          <img src={tapData.business.logoUrl} alt={tapData.business.name} className="w-16 h-16 rounded-2xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: `${fg}15` }}>
            {tapData?.business.name[0]}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">{tapData?.business.name}</h1>
          <p className="text-xs mt-0.5 opacity-40">Loyalty Card</p>
        </div>
      </div>

      {/* ── RETURNING CUSTOMER: single tap button ── */}
      {step === "ready" && (
        <div className="w-full max-w-xs space-y-6 text-center">
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}08`, border: `1px solid ${fg}20` }}>
            <div className="flex justify-between text-xs opacity-40 mb-3">
              <span>STAMPS</span>
              <span>{tapData?.loyaltyProgram?.goalValue} needed</span>
            </div>
            <StampGrid count={0} goal={tapData?.loyaltyProgram?.goalValue ?? 10} fg={fg} />
            <p className="text-xs opacity-30 mt-2">{tapData?.loyaltyProgram?.rewardDescription}</p>
          </div>

          <button
            onClick={addStamp}
            className="w-full py-5 rounded-2xl text-base font-bold tracking-wide transition-transform active:scale-95"
            style={{ backgroundColor: fg, color: bg }}
          >
            Tap to Add Stamp
          </button>

          <p className="text-xs opacity-25">Tap once per visit</p>
        </div>
      )}

      {/* ── STAMPING spinner ── */}
      {step === "stamping" && (
        <div className="flex items-center gap-2 text-sm opacity-50">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${fg}40`, borderTopColor: fg }} />
          Adding stamp…
        </div>
      )}

      {/* ── SUCCESS ── */}
      {step === "done" && result && (
        <div className="w-full max-w-xs text-center space-y-6">
          {result.status === "reward_ready" ? (
            <>
              <div className="text-5xl">🎉</div>
              <div>
                <p className="text-lg font-semibold">Reward unlocked!</p>
                <p className="text-sm opacity-60 mt-1">You earned: <strong>{result.rewardDescription}</strong></p>
                <p className="text-xs opacity-40 mt-1">Show this to the staff</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl">✓</div>
              <p className="text-lg font-semibold">
                {result.status === "enrolled" ? `Welcome, ${result.clientName}!` : `Stamped, ${result.clientName}!`}
              </p>
            </>
          )}

          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
            <p className="text-xs opacity-40 mb-3">{stamps} / {goal} stamps · {result.rewardDescription}</p>
            <StampGrid count={stamps} goal={goal} fg={fg} />
          </div>

          {/* Wallet button — shown on desktop or if auto-redirect didn't fire */}
          {result.googleWalletLink && device !== "Android" && (
            <a href={result.googleWalletLink} className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl text-sm font-semibold" style={{ backgroundColor: fg, color: bg }}>
              Add to Google Wallet
            </a>
          )}
        </div>
      )}

      {/* ── NEW CUSTOMER: name step ── */}
      {step === "name" && (
        <div className="w-full max-w-xs space-y-4">
          <p className="text-center text-sm opacity-60">Welcome! What&apos;s your name?</p>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name" autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && checkin(name)}
          />
          <button onClick={() => checkin(name)} disabled={!name.trim()}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}>
            Get My First Stamp
          </button>
        </div>
      )}

      {/* ── NEW CUSTOMER: phone step ── */}
      {step === "phone" && (
        <div className="w-full max-w-xs space-y-4">
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}08`, border: `1px solid ${fg}20` }}>
            <div className="flex justify-between text-xs opacity-40 mb-3">
              <span>STAMPS</span><span>0 / {tapData?.loyaltyProgram?.goalValue}</span>
            </div>
            <StampGrid count={0} goal={tapData?.loyaltyProgram?.goalValue ?? 10} fg={fg} />
            <p className="text-xs opacity-30 mt-2 text-center">Reward: {tapData?.loyaltyProgram?.rewardDescription}</p>
          </div>

          <p className="text-center text-sm opacity-50">First visit? Enter your number to join.</p>

          <input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number" autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && phone.trim().length >= 6 && checkin()}
          />
          <button onClick={() => checkin()} disabled={phone.trim().length < 6}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}>
            Join & Get First Stamp
          </button>

          <p className="text-xs text-center opacity-25">Next time you scan, just one tap — no typing.</p>
        </div>
      )}

    </div>
  );
}
