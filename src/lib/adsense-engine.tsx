import React, { useState, useEffect, useRef } from "react";
import {
  subscribePlayerPurchases,
  subscribeStoreConfig,
  type PlayerPurchasesProfile,
  type StoreRuntimeConfig,
} from "./purchases-engine";

const ADSENSE_FALLBACK_CLIENT_ID = "ca-pub-01094766495";
const ADSENSE_FALLBACK_SLOTS = {
  lobbyBanner: "8934521098",
  matchIntermission: "7823419012",
  marketFooter: "6712309823",
};

/** Canonical slot key → slot ID mapping (same as fallback slots). */
export const ADSENSE_SLOTS = ADSENSE_FALLBACK_SLOTS;

const AD_FREE_CACHE_KEY = "ufa_adfree_cache_v1";
const AD_FREE_EVENT = "ufa_ad_free_changed";

/**
 * Cold-start cache read (NOT a source of truth — Firestore profile wins always).
 * Only used so the UI doesn't flash ads on launch for legit VIP players before
 * the Firestore subscription delivers the authoritative truth.
 */
function getCachedAdFree(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AD_FREE_CACHE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Writes the verified Firestore value to a cache for next cold start. */
function setCachedAdFree(verifiedValue: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (verifiedValue) localStorage.setItem(AD_FREE_CACHE_KEY, "true");
    else localStorage.removeItem(AD_FREE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * ⛔ DEPRECATED / DEV-ONLY — DO NOT USE IN PRODUCTION CLIENT CODE
 * ⛔
 * ⛔ VIP/AD-FREE status is NEVER granted client-side.
 * ⛔ The ONLY legitimate way a player becomes VIP is when a payment
 * ⛔ is VERIFIED on the server/admin side and written into the
 * ⛔ player_purchases Firestore document. Any client-side write here
 * ⛔ is a temporary LOCAL PREVIEW FLIP that gets overwritten the very
 * ⛔ next time the Firestore `player_purchases` subscription fires.
 */
export function setAdFreeUser(localPreview: boolean) {
  if (typeof window === "undefined") return;
  try {
    // eslint-disable-next-line no-console
    console.warn(
      "⚠️ [VIP] setAdFreeUser() called from client — this is a LOCAL PREVIEW ONLY,",
      "NOT a real purchase. Will be overwritten by verified Firestore profile on next sync.",
    );
    window.dispatchEvent(
      new CustomEvent(AD_FREE_EVENT, { detail: { isAdFree: localPreview, preview: true } }),
    );
  } catch {
    /* ignore */
  }
}

/**
 * 💎 Verified source of truth for VIP Ad-Free status.
 *
 * If Firestore is reachable → subscription wins. If not → cold-cache fallback.
 * Exports both `isAdFree` and `profile` so components can also show
 * totalCoinsPurchased/totalSpent in profile pages/VIP receipts screens.
 */
export function useAdFreeStatus() {
  const [isAdFree, setIsAdFreeState] = useState<boolean>(() => getCachedAdFree());
  const [profile, setProfile] = useState<PlayerPurchasesProfile | null>(null);
  const previewFlipRef = useRef<number | null>(null);

  useEffect(() => {
    // Always subscribe to the verified Firestore source of truth
    const unsubPurchases = subscribePlayerPurchases((verified) => {
      // Override any local-preview flip — verified data wins permanently
      const truth = Boolean(verified.isAdFreeLifetime);
      setCachedAdFree(truth);
      setIsAdFreeState(truth);
      setProfile(verified);
      if (previewFlipRef.current) {
        window.clearTimeout(previewFlipRef.current);
        previewFlipRef.current = null;
      }
    });

    const onLocalPreview = (e: Event) => {
      const custom = e as CustomEvent<{ isAdFree?: boolean; preview?: boolean }>;
      if (custom.detail?.preview && typeof custom.detail.isAdFree === "boolean") {
        // Allow the preview flip — but schedule a re-check in 5 seconds to
        // show the user the truth if they tried to hack via console
        setIsAdFreeState(custom.detail.isAdFree);
        if (previewFlipRef.current) window.clearTimeout(previewFlipRef.current);
        previewFlipRef.current = window.setTimeout(() => {
          previewFlipRef.current = null;
          // Force a silent re-check: on next onSnapshot (or re-read cache + fall back)
          setIsAdFreeState(getCachedAdFree());
        }, 5_000);
      }
    };
    window.addEventListener(AD_FREE_EVENT, onLocalPreview);

    return () => {
      unsubPurchases();
      window.removeEventListener(AD_FREE_EVENT, onLocalPreview);
      if (previewFlipRef.current) window.clearTimeout(previewFlipRef.current);
    };
  }, []);

  return { isAdFree, profile, setAdFree: setAdFreeUser };
}

/** Live runtime config hook — payment numbers, ad slots, supported methods all come from Firestore. */
export function useStoreRuntimeConfig() {
  const [cfg, setCfg] = useState<StoreRuntimeConfig>(() => ({
    vodafoneCashNumber: "01094766495",
    instapayHandle: "01094766495@instapay",
    supportWhatsapp: "201094766495",
    paymentMethodsEnabled: ["vodafone_cash", "instapay"],
    adSenseClientId: ADSENSE_FALLBACK_CLIENT_ID,
    adSenseSlots: ADSENSE_FALLBACK_SLOTS,
  }));
  useEffect(() => subscribeStoreConfig((c) => setCfg(c)), []);
  return cfg;
}

/** Ensures Google AdSense <script> is in the <head> using the runtime-verified client ID. */
export function ensureAdSenseScriptLoaded(clientId: string) {
  if (typeof window === "undefined") return;
  if (document.getElementById("google-adsense-script")) return;
  try {
    const script = document.createElement("script");
    script.id = "google-adsense-script";
    const safeClient = clientId?.startsWith("ca-pub-") ? clientId : ADSENSE_FALLBACK_CLIENT_ID;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${safeClient}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  } catch {
    /* ignore */
  }
}

export function pushAdSenseAd() {
  if (typeof window === "undefined") return;
  try {
    const win = window as any;
    win.adsbygoogle = win.adsbygoogle || [];
    win.adsbygoogle.push({});
  } catch {
    /* ignore */
  }
}

interface AdSenseBannerProps {
  slotId?: "lobbyBanner" | "matchIntermission" | "marketFooter";
  format?: "auto" | "horizontal" | "rectangle";
  className?: string;
}

/**
 * Responsive Google AdSense Banner — fully reactive to both:
 *  - Verified VIP status (hides itself if player paid for ad-free)
 *  - Runtime Firestore config (pulls client id + slot ids remotely)
 */
export function AdSenseBanner({
  slotId = "lobbyBanner",
  format = "auto",
  className = "",
}: AdSenseBannerProps) {
  const { isAdFree } = useAdFreeStatus();
  const storeCfg = useStoreRuntimeConfig();
  const [adLoaded, setAdLoaded] = useState(false);

  const effectiveClientId =
    storeCfg.adSenseClientId && storeCfg.adSenseClientId.startsWith("ca-pub-")
      ? storeCfg.adSenseClientId
      : ADSENSE_FALLBACK_CLIENT_ID;
  const effectiveSlotId =
    storeCfg.adSenseSlots?.[slotId] ?? ADSENSE_FALLBACK_SLOTS[slotId] ?? ADSENSE_FALLBACK_SLOTS.lobbyBanner;

  useEffect(() => {
    if (isAdFree) return;
    ensureAdSenseScriptLoaded(effectiveClientId);
    const timer = setTimeout(() => {
      pushAdSenseAd();
      setAdLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [isAdFree, effectiveClientId]);

  // Completely hidden if player owns the verified VIP Ad-Free Lifetime pass
  if (isAdFree) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#071322]/80 via-[#0a182a]/80 to-[#071322]/80 p-2 text-center text-white/50 backdrop-blur-md shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between px-2 pb-1 text-[9px] text-white/40 border-b border-white/5 mb-1.5">
        <span className="font-mono">Google AdSense • إعلان ممول</span>
        <span className="text-amber-400/80">احصل على عضوية VIP لإزالة الإعلانات 🛡️</span>
      </div>

      {/* Google AdSense container */}
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight: "60px" }}
        data-ad-client={effectiveClientId}
        data-ad-slot={effectiveSlotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />

      {/* Fallback Display if Adblocker is active or Ad is loading */}
      {!adLoaded && (
        <div className="py-2.5 px-3 flex items-center justify-between gap-2 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-white text-[11px]">
              ⚽ أساطير المزاد • الراعي الرسمي 2026
            </span>
          </div>
          <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            AdSense Space
          </span>
        </div>
      )}
    </div>
  );
}
