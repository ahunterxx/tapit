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
  walletUpdated?: boolean;
}

// loading  → fetching business info
// ready    → returning customer, show "Tap to Add Stamp" button
// phone    → new customer, enter phone
// name     → new customer, enter name
// stamping → API call in flight
// done     → success (stamp given this session)
// error    → business not found
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

  // localStorage: remembers WHO this customer is across tabs/sessions
  const localKey = `tapit_${slug}`;
  // sessionStorage: remembers that a stamp was given IN THIS TAB OPEN
  // cleared when tab closes — so scanning again (new tab) allows another stamp
  const sessionKey = `tapit_session_${slug}`;

  const showResult = useCallback((data: StampResult) => {
    // Persist clientId for future scans
    if (data.clientId) localStorage.setItem(localKey, data.clientId);
    // Persist result for this session so refresh doesn't re-stamp
    sessionStorage.setItem(sessionKey, JSON.stringify(data));
    setResult(data);

    // Auto-redirect wallet links on mobile
    if (data.applePassUrl && device === "iOS") { window.location.href = data.applePassUrl; return; }
    if (data.googleWalletLink && device === "Android") { window.location.href = data.googleWalletLink; return; }

    setStep("done");
  }, [device, localKey, sessionKey]);

  useEffect(() => {
    fetch(`${API}/tap/${slug}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: TapData) => {
        setTapData(d);

        // 1. Already stamped this session (same open tab)? Show success — no API call.
        const sessionData = sessionStorage.getItem(sessionKey);
        if (sessionData) {
          setResult(JSON.parse(sessionData) as StampResult);
          setStep("done");
          return;
        }

        // 2. Known returning customer? Show the stamp button.
        const savedId = localStorage.getItem(localKey);
        if (savedId) {
          setStoredClientId(savedId);
          setStep("ready");
          return;
        }

        // 3. First-time visitor.
        setStep("phone");
      })
      .catch(() => setStep("error"));
  }, [slug, localKey, sessionKey]);

  // Returning customer presses "Tap to Add Stamp"
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
        // Stored ID no longer valid — clear and fall back to phone form
        localStorage.removeItem(localKey);
        setStoredClientId(null);
        setStep("phone");
        return;
      }
      showResult(data);
    } catch {
      setStep("ready");
    }
  }

  // First-time / phone-based check-in
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
      showResult(data);
    } catch {
      setStep("phone");
    }
  }

  const bg = tapData?.loyaltyProgram?.backgroundColor ?? tapData?.business.brandColor ?? "#0a0a0a";
  const fg = tapData?.loyaltyProgram?.foregroundColor ?? "#ffffff";
  const goal = result?.goalValue ?? tapData?.loyaltyProgram?.goalValue ?? 10;
  const stamps = result?.stampsCount ?? 0;

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0a0a0a" }}>
        <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
        <p className="opacity-40 text-sm">This loyalty card doesn&apos;t exist.</p>
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

      {/* ── Returning customer: one-tap button ─────────────────────────────── */}
      {step === "ready" && (
        <div className="w-full max-w-xs space-y-5 text-center">
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}08`, border: `1px solid ${fg}20` }}>
            <p className="text-xs opacity-30 mb-3">{tapData?.loyaltyProgram?.rewardDescription} · {tapData?.loyaltyProgram?.goalValue} stamps needed</p>
            <StampGrid count={0} goal={tapData?.loyaltyProgram?.goalValue ?? 10} fg={fg} />
          </div>
          <button
            onClick={addStamp}
            className="w-full py-5 rounded-2xl text-base font-bold tracking-wide transition-transform active:scale-95"
            style={{ backgroundColor: fg, color: bg }}
          >
            Tap to Add Stamp
          </button>
          <p className="text-xs opacity-20">One stamp per visit</p>
        </div>
      )}

      {/* ── Stamping spinner ─────────────────────────────────────────────────── */}
      {step === "stamping" && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${fg}30`, borderTopColor: fg }} />
          <p className="text-sm opacity-40">Adding stamp…</p>
        </div>
      )}

      {/* ── Success ──────────────────────────────────────────────────────────── */}
      {step === "done" && result && (
        <div className="w-full max-w-xs text-center space-y-5">
          {result.status === "reward_ready" ? (
            <>
              <div className="text-5xl mb-1">🎉</div>
              <p className="text-lg font-bold">Reward unlocked!</p>
              <p className="text-sm opacity-60">You earned: <strong>{result.rewardDescription}</strong></p>
              <p className="text-xs opacity-40">Show this screen to the staff</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-1">✓</div>
              <p className="text-lg font-bold">
                {result.status === "enrolled" ? `Welcome, ${result.clientName}!` : `Stamped!`}
              </p>
            </>
          )}

          {/* Stamp grid */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}10`, border: `1px solid ${fg}20` }}>
            <div className="flex justify-between text-xs opacity-40 mb-3">
              <span>{result.clientName}</span>
              <span>{stamps} / {goal}</span>
            </div>
            <StampGrid count={stamps} goal={goal} fg={fg} />
            <p className="text-xs opacity-30 mt-2">{result.rewardDescription}</p>
          </div>

          {/* Wallet status */}
          <p className="text-xs opacity-30">
            {result.googleWalletLink
              ? "Save your card to Google Wallet below"
              : "Your Wallet card has been updated ✓"}
          </p>

          {/* Wallet button — shown if this was enrollment or if auto-redirect didn't fire */}
          {result.googleWalletLink && (
            <a
              href={result.googleWalletLink}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: fg, color: bg }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Add to Google Wallet
            </a>
          )}
        </div>
      )}

      {/* ── New customer: name step ───────────────────────────────────────────── */}
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
          <button
            onClick={() => checkin(name)} disabled={!name.trim()}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}
          >
            Get My First Stamp
          </button>
        </div>
      )}

      {/* ── New customer: phone step ──────────────────────────────────────────── */}
      {step === "phone" && (
        <div className="w-full max-w-xs space-y-4">
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${fg}08`, border: `1px solid ${fg}20` }}>
            <div className="flex justify-between text-xs opacity-30 mb-3">
              <span>STAMPS</span><span>0 / {tapData?.loyaltyProgram?.goalValue}</span>
            </div>
            <StampGrid count={0} goal={tapData?.loyaltyProgram?.goalValue ?? 10} fg={fg} />
            <p className="text-xs opacity-25 mt-2 text-center">Reward: {tapData?.loyaltyProgram?.rewardDescription}</p>
          </div>

          <p className="text-center text-sm opacity-50">First visit? Enter your number to join.</p>

          <input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Your phone number" autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: `${fg}10`, color: fg, border: `1px solid ${fg}20` }}
            onKeyDown={(e) => e.key === "Enter" && phone.trim().length >= 6 && checkin()}
          />
          <button
            onClick={() => checkin()} disabled={phone.trim().length < 6}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ backgroundColor: fg, color: bg }}
          >
            Join & Get First Stamp
          </button>

          <p className="text-xs text-center opacity-20">Next scan is just one tap — no typing needed.</p>
        </div>
      )}

    </div>
  );
}
