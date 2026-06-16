"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface TapData {
  business: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    brandColor: string;
  };
  loyaltyProgram: {
    cardType: string;
    goalValue: number;
    rewardDescription: string;
    backgroundColor: string;
    foregroundColor: string;
  } | null;
  capabilities: {
    appleWallet: boolean;
    googleWallet: boolean;
  };
}

type Step = "loading" | "error" | "landing" | "enrolling" | "done";

function detectDevice(): "iOS" | "Android" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  return "other";
}

export default function TapPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<TapData | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [walletLink, setWalletLink] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const device = detectDevice();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/tap/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Business not found");
        return r.json();
      })
      .then((d: TapData) => {
        setData(d);
        setStep("landing");
      })
      .catch(() => {
        setErrorMsg("This loyalty card doesn't exist.");
        setStep("error");
      });
  }, [slug]);

  async function enroll(deviceType: "APPLE" | "GOOGLE") {
    if (!name.trim()) return;
    setStep("enrolling");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tap/${slug}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined, deviceType }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409) {
          setErrorMsg("You're already enrolled! Ask the business to stamp your card.");
          setStep("done");
          return;
        }
        throw new Error(err.error);
      }

      const result = await res.json();

      if (deviceType === "APPLE" && result.applePassUrl) {
        window.location.href = result.applePassUrl;
        return;
      }

      if (deviceType === "GOOGLE" && result.googleWalletLink) {
        setWalletLink(result.googleWalletLink);
        // Auto-redirect on Android — on desktop show the button (for testing)
        if (device === "Android") {
          window.location.href = result.googleWalletLink;
          return;
        }
      }

      setStep("done");
    } catch (err: unknown) {
      setErrorMsg((err as Error).message ?? "Something went wrong. Try again.");
      setStep("landing");
    }
  }

  const bg = data?.business.brandColor ?? "#0a0a0a";
  const fg = data?.loyaltyProgram?.foregroundColor ?? "#ffffff";
  const goal = data?.loyaltyProgram?.goalValue ?? 10;
  const reward = data?.loyaltyProgram?.rewardDescription ?? "Free reward";

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
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* Logo or Business Initial */}
      <div className="mb-8 flex flex-col items-center gap-4">
        {data?.business.logoUrl ? (
          <img
            src={data.business.logoUrl}
            alt={data.business.name}
            className="w-20 h-20 rounded-2xl object-cover"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: `${fg}15`, color: fg }}
          >
            {data?.business.name[0]}
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: fg }}>
            {data?.business.name}
          </h1>
          <p className="text-sm mt-1 opacity-60" style={{ color: fg }}>
            Loyalty Card
          </p>
        </div>
      </div>

      {/* Stamp preview */}
      <div
        className="w-full max-w-xs rounded-2xl p-5 mb-8 border"
        style={{ backgroundColor: `${fg}08`, borderColor: `${fg}20` }}
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-medium opacity-50 uppercase tracking-wider" style={{ color: fg }}>
            Stamps
          </span>
          <span className="text-xs font-mono" style={{ color: fg }}>
            0 / {goal}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.min(goal, 10) }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-lg border flex items-center justify-center text-xs"
              style={{ borderColor: `${fg}25`, color: `${fg}25` }}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <p className="text-xs mt-3 opacity-50 text-center" style={{ color: fg }}>
          Reward: {reward}
        </p>
      </div>

      {step === "done" ? (
        <div className="text-center space-y-4 w-full max-w-xs">
          {errorMsg ? (
            <p className="text-sm opacity-70" style={{ color: fg }}>{errorMsg}</p>
          ) : (
            <>
              <div className="text-5xl mb-2">✓</div>
              <p className="text-lg font-semibold" style={{ color: fg }}>
                You&apos;re in, {name}!
              </p>
              <p className="text-sm opacity-60" style={{ color: fg }}>
                {walletLink
                  ? "Tap below to save your loyalty card to Google Wallet."
                  : "Your loyalty card has been saved to your Wallet."}
              </p>
              {walletLink && (
                <a
                  href={walletLink}
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: fg, color: bg }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Add to Google Wallet
                </a>
              )}
            </>
          )}
        </div>
      ) : step === "enrolling" ? (
        <div className="flex items-center gap-2 text-sm opacity-60" style={{ color: fg }}>
          <div
            className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${fg}40`, borderTopColor: fg }}
          />
          Setting up your card...
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: `${fg}10`,
                color: fg,
                border: `1px solid ${fg}20`,
              }}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number (optional)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: `${fg}10`,
                color: fg,
                border: `1px solid ${fg}20`,
              }}
            />
          </div>

          {/* Show appropriate button based on device */}
          {(device === "iOS" || device === "other") && data?.capabilities.appleWallet && (
            <button
              onClick={() => enroll("APPLE")}
              disabled={!name.trim()}
              className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: fg, color: bg }}
            >
              Add to Apple Wallet
            </button>
          )}

          {(device === "Android" || device === "other") && data?.capabilities.googleWallet && (
            <button
              onClick={() => enroll("GOOGLE")}
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
              style={{
                backgroundColor: `${fg}12`,
                color: fg,
                border: `1px solid ${fg}30`,
              }}
            >
              {/* Google G icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Add to Google Wallet
            </button>
          )}

          {!data?.capabilities.appleWallet && !data?.capabilities.googleWallet && (
            <button
              onClick={() => enroll("GOOGLE")}
              disabled={!name.trim()}
              className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: fg, color: bg }}
            >
              Join Loyalty Program
            </button>
          )}

          <p className="text-xs text-center opacity-40" style={{ color: fg }}>
            No app needed. Your loyalty card lives in your phone&apos;s Wallet.
          </p>
        </div>
      )}
    </div>
  );
}
