"use client";

import { Github, Info, Loader2, Lock, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config";
import { RegionServicePicker } from "@/components/RegionServicePicker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { MONETIZATION_TYPES, THEMES, type SettingsPatch } from "@/lib/config";

const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: "Crimson", value: "0 72% 51%" },
  { name: "Azure", value: "210 90% 56%" },
  { name: "Violet", value: "265 80% 62%" },
  { name: "Emerald", value: "152 60% 45%" },
  { name: "Amber", value: "38 92% 50%" },
];

export function SettingsForm() {
  const { config, refresh } = useConfig();
  const { toast } = useToast();
  const router = useRouter();
  const locked = config.core.lockConfig;

  // Esc leaves Settings - unless you're editing a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Non-secret draft is seeded from the public config.
  const [region, setRegion] = useState(config.region.region);
  const [services, setServices] = useState<number[]>(config.region.services);
  const [monetization, setMonetization] = useState<string[]>(config.region.monetizationTypes);
  const [language, setLanguage] = useState(config.tmdb.language);
  const [externalUrl, setExternalUrl] = useState(config.seerr.externalUrl);
  const [requestMode, setRequestMode] = useState(config.seerr.requestMode);
  const [enableLibraryRails, setLibraryRails] = useState(config.features.enableLibraryRails);
  const [heroRotate, setHeroRotate] = useState(config.features.heroRotateSeconds);
  const [enableRecs, setEnableRecs] = useState(config.recs.enableRecommendations);
  const [theme, setTheme] = useState(config.appearance.theme);
  const [accent, setAccent] = useState(config.appearance.accent);

  // Write-only fields start blank; placeholders indicate "configured".
  const [tmdbApiKey, setTmdbApiKey] = useState("");
  const [tmdbToken, setTmdbToken] = useState("");
  const [seerrInternalUrl, setSeerrInternalUrl] = useState("");
  const [seerrApiKey, setSeerrApiKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"tmdb" | "seerr" | null>(null);

  const applyTheme = (t: typeof theme) => {
    setTheme(t);
    document.documentElement.classList.toggle("light", t === "light");
  };
  const applyAccent = (a: string) => {
    setAccent(a);
    document.body.style.setProperty("--accent", a);
  };

  const buildPatch = (): SettingsPatch => ({
    tmdb: {
      language,
      ...(tmdbApiKey ? { apiKey: tmdbApiKey } : {}),
      ...(tmdbToken ? { accessToken: tmdbToken } : {}),
    },
    seerr: {
      externalUrl,
      requestMode,
      ...(seerrInternalUrl ? { internalUrl: seerrInternalUrl } : {}),
      ...(seerrApiKey ? { apiKey: seerrApiKey } : {}),
    },
    region: { region, services, monetizationTypes: monetization as never },
    recs: { enableRecommendations: enableRecs },
    features: { enableLibraryRails, heroRotateSeconds: heroRotate },
    appearance: { theme, accent },
  });

  const save = async () => {
    setSaving(true);
    try {
      await api.saveConfig(buildPatch());
      await refresh();
      setTmdbApiKey("");
      setTmdbToken("");
      setSeerrInternalUrl("");
      setSeerrApiKey("");
      toast({ title: "Settings saved", variant: "success" });
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async (target: "tmdb" | "seerr") => {
    setTesting(target);
    try {
      const res =
        target === "tmdb"
          ? await api.testConnection({ target, apiKey: tmdbApiKey || undefined, accessToken: tmdbToken || undefined })
          : await api.testConnection({ target, internalUrl: seerrInternalUrl || undefined, apiKey: seerrApiKey || undefined });
      toast({ title: res.detail, variant: "success" });
    } catch (err) {
      toast({
        title: `${target.toUpperCase()} test failed`,
        description: err instanceof Error ? err.message : "Error",
        variant: "error",
      });
    } finally {
      setTesting(null);
    }
  };

  const resetTaste = async () => {
    await api.resetTaste().catch(() => {});
    toast({ title: "Taste profile reset", description: "Recommendations will re-seed from your library." });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 pb-32 pt-24 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black">Settings</h1>
            <InfoHint text="Environment variables seed these fields. Changes you save here override them - unless LOCK_CONFIG is set, which makes every field read-only." />
          </div>
          <p className="text-sm text-muted-foreground">Connect your stack and tune your experience.</p>
        </div>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold transition hover:bg-white/10"
        >
          <X className="h-4 w-4" /> Done
        </Link>
      </div>

      {locked && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-600/40 bg-amber-600/10 p-3 text-sm">
          <Lock className="h-5 w-5 text-amber-400" />
          Configuration is locked by <code className="rounded bg-black/30 px-1">LOCK_CONFIG</code>. Edit
          via environment variables.
        </div>
      )}

      {/* Connections */}
      <Section title="TMDB" subtitle="Catalog, watch providers, trailers, recommendations.">
        <Field label="API key (v3)">
          <Password value={tmdbApiKey} onChange={setTmdbApiKey} placeholder={config.tmdb.hasKey ? "•••••••• (configured)" : "Enter TMDB v3 key"} disabled={locked} />
        </Field>
        <Field label="Access token (v4) - optional alternative">
          <Password value={tmdbToken} onChange={setTmdbToken} placeholder={config.tmdb.hasKey ? "•••••••• (configured)" : "Bearer token"} disabled={locked} />
        </Field>
        <Field label="Language">
          <Text value={language} onChange={setLanguage} placeholder="en-US" disabled={locked} />
        </Field>
        <Button variant="secondary" size="sm" onClick={() => test("tmdb")} disabled={testing === "tmdb"}>
          {testing === "tmdb" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Test TMDB
        </Button>
      </Section>

      <Section title="Seerr" subtitle="Library availability + requests. Internal URL is server-only and never shown.">
        <Field label="Internal URL (server-to-server)">
          <Text
            value={seerrInternalUrl}
            onChange={setSeerrInternalUrl}
            placeholder={config.seerr.configured ? "configured (hidden)" : "http://seerr:5055"}
            disabled={locked}
          />
        </Field>
        <Field label="External URL (browser redirects)">
          <Text value={externalUrl} onChange={setExternalUrl} placeholder="https://requests.example.com" disabled={locked} />
        </Field>
        <Field label="API key">
          <Password value={seerrApiKey} onChange={setSeerrApiKey} placeholder={config.seerr.hasKey ? "•••••••• (configured)" : "Seerr API key"} disabled={locked} />
        </Field>
        <Field label="Request mode">
          <select
            value={requestMode}
            disabled={locked}
            onChange={(e) => setRequestMode(e.target.value as typeof requestMode)}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            <option value="redirect">redirect - open Seerr in a new tab</option>
            <option value="proxy">proxy - submit via Browserr (needs Seerr auth)</option>
          </select>
        </Field>
        <Button variant="secondary" size="sm" onClick={() => test("seerr")} disabled={testing === "seerr"}>
          {testing === "seerr" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Test Seerr
        </Button>
      </Section>

      <Section title="Region & services" subtitle="Only services that exist in the selected region are shown.">
        <RegionServicePicker
          region={region}
          services={services}
          onRegionChange={(r) => {
            setRegion(r);
            setServices([]); // re-derive selection for the new region
          }}
          onServicesChange={setServices}
          disabled={locked}
        />
        <Field label="Monetization types">
          <div className="flex flex-wrap gap-2">
            {MONETIZATION_TYPES.map((m) => {
              const on = monetization.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setMonetization(on ? monetization.filter((x) => x !== m) : [...monetization, m])
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                    on ? "bg-accent text-accent-foreground" : "bg-muted hover:bg-muted/70"
                  } disabled:opacity-60`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </Field>
      </Section>

      <Section title="Features">
        <ToggleRow label="Library rails (from Seerr)" checked={enableLibraryRails} onChange={setLibraryRails} disabled={locked} />
        <ToggleRow label="Self-learning recommendations" checked={enableRecs} onChange={setEnableRecs} disabled={locked} />
        <Field label={`Hero rotation: ${heroRotate}s`}>
          <input
            type="range"
            min={0}
            max={30}
            value={heroRotate}
            disabled={locked}
            onChange={(e) => setHeroRotate(Number(e.target.value))}
            className="w-full max-w-xs accent-[hsl(var(--accent))]"
          />
        </Field>
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                disabled={locked}
                onClick={() => applyTheme(t)}
                className={`rounded-md border px-4 py-2 text-sm capitalize transition ${
                  theme === t ? "border-accent bg-accent/10" : "border-border hover:bg-white/5"
                } disabled:opacity-60`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Accent">
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                disabled={locked}
                title={p.name}
                onClick={() => applyAccent(p.value)}
                style={{ backgroundColor: `hsl(${p.value})` }}
                className={`h-9 w-9 rounded-full border-2 transition ${
                  accent === p.value ? "border-white" : "border-transparent"
                } disabled:opacity-60`}
              />
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Privacy & taste" subtitle="Transparency controls for recommendations.">
        <Button variant="outline" size="sm" onClick={resetTaste} disabled={locked}>
          <RotateCcw className="h-4 w-4" /> Reset taste profile
        </Button>
      </Section>

      <footer className="flex flex-col items-center gap-1.5 pt-4 text-center text-xs text-muted-foreground">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition hover:text-foreground"
        >
          <Github className="h-3.5 w-3.5" /> janpuc/browserr
        </a>
        <span>
          Browserr <span className="tabular-nums">v{config.core.version}</span>
        </span>
      </footer>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3 md:px-8">
          {locked && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-amber-400">
              <Lock className="h-3.5 w-3.5" /> Read-only
            </span>
          )}
          <Button onClick={save} disabled={saving || locked}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

const REPO_URL = "https://github.com/janpuc/browserr";

/** Small info circle with a hover/focus tooltip. */
function InfoHint({ text }: { text: string }) {
  return (
    <span className="group/hint relative inline-flex" tabIndex={0}>
      <Info className="h-4 w-4 cursor-help text-muted-foreground transition group-hover/hint:text-foreground" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-7 z-50 w-64 -translate-x-1/2 rounded-md border border-border bg-popover p-2 text-left text-xs font-normal leading-relaxed text-popover-foreground opacity-0 shadow-xl transition-opacity duration-150 group-hover/hint:opacity-100 group-focus/hint:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Text({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    />
  );
}

function Password(props: Parameters<typeof Text>[0]) {
  return (
    <input
      type="password"
      autoComplete="new-password"
      value={props.value}
      placeholder={props.placeholder}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value)}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    />
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
