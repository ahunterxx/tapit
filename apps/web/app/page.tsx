import Link from "next/link";
import {
  Zap,
  Smartphone,
  Bell,
  BarChart3,
  ArrowRight,
  Check,
  Scissors,
  Coffee,
  Dumbbell,
  Sparkles,
} from "lucide-react";

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[220px]">
      {/* Phone frame */}
      <div className="relative rounded-[36px] border-[6px] border-white/10 bg-[#111] shadow-2xl shadow-black/60 overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <span className="text-[10px] text-white/50 font-medium">9:41</span>
          <div className="w-16 h-4 bg-[#111] rounded-full" />
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 rounded-sm border border-white/40" />
          </div>
        </div>

        {/* Google Wallet card */}
        <div className="mx-3 mb-4 rounded-2xl overflow-hidden">
          {/* Card header */}
          <div className="bg-[#1a1a2e] px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">STAMPS</p>
                <p className="text-xl font-bold text-white font-mono">7 / 10</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">REWARD</p>
                <p className="text-[11px] text-white font-medium">Free haircut</p>
              </div>
            </div>
            {/* Stamp grid */}
            <div className="grid grid-cols-5 gap-1 mb-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded flex items-center justify-center text-[8px] font-bold"
                  style={{
                    backgroundColor: i < 7 ? "#ffffff" : "rgba(255,255,255,0.08)",
                    color: i < 7 ? "#1a1a2e" : "rgba(255,255,255,0.2)",
                  }}
                >
                  {i < 7 ? "✓" : ""}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-white/30 uppercase tracking-wider">Cairo Cuts Barbershop</p>
          </div>
          {/* Card bottom */}
          <div className="bg-[#141428] px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5.26 12.27L9.27 16.28L18.74 6.81" stroke="#34A853" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[9px] text-white/30">Google Wallet</span>
            </div>
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FBBC05]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
            </div>
          </div>
        </div>

        {/* Lock screen notification */}
        <div className="mx-3 mb-4 rounded-xl bg-white/5 border border-white/8 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded bg-[#1a1a2e] shrink-0 mt-0.5 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-white font-medium">Tap It · now</p>
              <p className="text-[9px] text-white/60 leading-relaxed mt-0.5">
                🎉 3 more stamps and you get a free haircut at Cairo Cuts!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-40 h-20 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
    </div>
  );
}

const businesses = [
  { icon: Scissors, label: "Barbershops" },
  { icon: Sparkles, label: "Hair Salons" },
  { icon: Sparkles, label: "Nail Studios" },
  { icon: Coffee, label: "Cafés" },
  { icon: Dumbbell, label: "Gyms" },
  { icon: Coffee, label: "Restaurants" },
];

const features = [
  {
    icon: Smartphone,
    title: "Apple & Google Wallet",
    body: "Passes live next to boarding passes and credit cards. Always visible, never buried in an app.",
  },
  {
    icon: Bell,
    title: "Push notifications — free",
    body: "Send messages to your clients' lock screens. No SMS cost. No third-party app. Just tap send.",
  },
  {
    icon: Zap,
    title: "Zero friction for customers",
    body: "Name + phone number, one tap. Card is in their Wallet before they leave the counter.",
  },
  {
    icon: BarChart3,
    title: "Clean business dashboard",
    body: "Every client, their stamp count, last visit, and automated win-back campaigns — one place.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="font-semibold tracking-tight text-sm">Tap It</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#how-it-works"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              How it works
            </a>
            <a
              href="#pricing"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <a
              href="mailto:abdullahunter6@gmail.com?subject=Tap It - I want to get started"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Egypt&apos;s first NFC loyalty platform
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
              Loyalty cards that
              <br />
              live in{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">
                Apple & Google
              </span>
              <br />
              Wallet
            </h1>

            <p className="text-base text-muted-foreground leading-relaxed mb-8 max-w-md">
              Customer taps your QR code or NFC card — a branded loyalty stamp
              card appears in their Wallet in seconds. No app. No friction. You
              manage everything from a dashboard.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="mailto:abdullahunter6@gmail.com?subject=Tap It - I want to get started"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Get started for your business
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Business login →
              </Link>
            </div>

            <div className="flex items-center gap-6 mt-8 pt-8 border-t border-border/50">
              {[
                { value: "0", label: "App installs required" },
                { value: "30s", label: "Setup per customer" },
                { value: "EGP", label: "Priced for Egypt" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-border/50 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-3">
            How it works
          </p>
          <h2 className="text-2xl font-bold text-center mb-14">
            Three taps, zero app downloads
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Customer taps or scans",
                body: "Place a QR code or NFC sticker at your counter. Customer taps with their phone — no download needed.",
                emoji: "📱",
              },
              {
                step: "02",
                title: "Wallet card appears instantly",
                body: "A branded loyalty stamp card is added to Apple Wallet or Google Wallet. They see it right there.",
                emoji: "💳",
              },
              {
                step: "03",
                title: "Earn, get rewarded, come back",
                body: "You stamp from your dashboard. When they hit the goal, they get a push notification on their lock screen.",
                emoji: "🎉",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-6 rounded-2xl border border-border bg-card"
              >
                <div className="text-3xl mb-4">{item.emoji}</div>
                <span className="text-xs font-mono text-muted-foreground/50">{item.step}</span>
                <h3 className="text-base font-semibold mt-1 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-3">
            Features
          </p>
          <h2 className="text-2xl font-bold text-center mb-14">
            Everything your business needs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-4 p-5 rounded-2xl border border-border bg-card hover:border-border/80 transition-colors"
              >
                <div className="p-2.5 rounded-xl bg-secondary shrink-0 h-fit">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="border-t border-border/50 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-3">
            Built for
          </p>
          <h2 className="text-2xl font-bold text-center mb-4">
            Any local Egyptian business
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-10 max-w-md mx-auto">
            If you depend on repeat customers, Tap It turns every visit into
            loyalty — without paper punch cards that get lost.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {businesses.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card text-center"
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-xs text-muted-foreground uppercase tracking-widest text-center mb-3">
            Pricing
          </p>
          <h2 className="text-2xl font-bold text-center mb-4">
            Priced for the Egyptian market
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-12 max-w-md mx-auto">
            Custom pricing in EGP — a fraction of what Western competitors charge.
            Contact us to discuss your business.
          </p>

          <div className="max-w-sm mx-auto rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              All-inclusive
            </p>
            <div className="text-4xl font-bold mb-1">Custom</div>
            <p className="text-sm text-muted-foreground mb-6">Priced in EGP, per your volume</p>

            <ul className="space-y-3 text-left mb-8">
              {[
                "Unlimited stamp cards",
                "Apple & Google Wallet passes",
                "Push notifications (free, no SMS cost)",
                "Business dashboard",
                "Automated win-back campaigns",
                "QR code + NFC support",
                "Setup included",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <a
              href="mailto:abdullahunter6@gmail.com?subject=Tap It - Pricing inquiry"
              className="block w-full py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Contact us for pricing
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/50 bg-card/20">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to modernize your loyalty program?
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
            We set everything up for you. First customer scanning in under an hour.
          </p>
          <a
            href="mailto:abdullahunter6@gmail.com?subject=Tap It - I want to get started"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get started today
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tap It</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a
              href="mailto:abdullahunter6@gmail.com"
              className="hover:text-foreground transition-colors"
            >
              abdullahunter6@gmail.com
            </a>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Business login
            </Link>
            <span>© {new Date().getFullYear()} Tap It — Egypt</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
