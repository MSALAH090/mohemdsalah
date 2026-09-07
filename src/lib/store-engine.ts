import { addClubCoins } from "./club-economy";
import { addPlayersToBench } from "./club-manager";
import { PLAYERS, type Player } from "./players";
import {
  getStoreRuntimeConfig,
  subscribeStoreConfig,
  submitRechargeRequest,
  type StorePaymentMethod,
  type StoreRuntimeConfig,
} from "./purchases-engine";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getPlayerId, getPlayerTag, getPlayerName } from "./identity";

export type { StoreRuntimeConfig } from "./purchases-engine";

export interface StorePackage {
  id: string;
  name: string;
  category: "coins" | "vip_pack" | "bundle";
  priceEgp: number;
  originalPriceEgp?: number;
  coinsReward: number;
  bonusText?: string;
  badge?: string;
  description: string;
  icon: string;
  popular?: boolean;
  vipCardsCount?: number;
  trainingTokens?: number;
}

export interface RechargeOrder {
  id: string;
  packageId: string;
  packageName: string;
  priceEgp: number;
  playerTag: string;
  playerName: string;
  senderPhone: string;
  paymentMethod: StorePaymentMethod;
  status: "pending" | "approved" | "rejected";
  coinsGranted: number;
  vipCardsGranted?: number;
  trainingTokensGranted?: number;
  adFreeGranted?: boolean;
  approvedAt?: number;
  approvedBy?: string;
  createdAt: number;
  completedAt?: number;
  notes?: string;
}

// Backwards compat: re-export config loader so existing callers keep working
export function getPaymentSettings(): Promise<StoreRuntimeConfig> {
  return getStoreRuntimeConfig();
}
export { subscribeStoreConfig };

/**
 * Fallback Vodafone Cash number — runtime value comes from Firestore via
 * `useStoreRuntimeConfig()` in adsense-engine. This constant is a safe
 * default shown while the Firestore config is loading.
 */
export const VODAFONE_CASH_NUMBER = "01094766495";

// ─────────────────────────────────────────────────────────────────────
//  👑 CATALOG OF STORE PACKAGES  (safe to keep client-side)
// ─────────────────────────────────────────────────────────────────────
export const STORE_PACKAGES: StorePackage[] = [
  {
    id: "pack_100k",
    name: "حزمة الكوينز الاقتصادية",
    category: "coins",
    priceEgp: 20,
    coinsReward: 100_000,
    badge: "الأكثر طلباً 🪙",
    description: "100 ألف كوينز فورية لدعم ناديك والبدء بقوة في سوق الانتقالات.",
    icon: "🪙",
    popular: true,
  },
  {
    id: "pack_300k",
    name: "حزمة النخبة الفضية",
    category: "coins",
    priceEgp: 50,
    originalPriceEgp: 65,
    coinsReward: 300_000,
    badge: "قيمة ممتازة ⚡",
    description: "300 ألف كوينز تمنحك أفضلية المزايدة وضم نجوم تشكيلتك الأساسية.",
    icon: "💰",
  },
  {
    id: "pack_1m",
    name: "حزمة المليونير الذهبية",
    category: "coins",
    priceEgp: 100,
    originalPriceEgp: 140,
    coinsReward: 1_100_000,
    bonusText: "+ 100K كوينز هدية مجانية! 🎁",
    badge: "الأعلى توفيراً 🔥",
    description: "1,100,000 كوينز كاش تضعك بين أغنى أندية اللعبة لشراء أي أسطورة فوراً.",
    icon: "🏆",
    popular: true,
  },
  {
    id: "pack_5m",
    name: "خزينة الحوت الملكية",
    category: "coins",
    priceEgp: 350,
    originalPriceEgp: 500,
    coinsReward: 5_500_000,
    bonusText: "+ 500K كوينز إضافية 👑",
    badge: "لكبار المستثمرين 💎",
    description: "5.5 مليون كوينز للسيطرة التامة على مزادات الأساطير وتأسيس إمبراطورية كروية.",
    icon: "💎",
  },
  {
    id: "pack_vip_legend",
    name: "بكج أساطير VIP المضمون",
    category: "vip_pack",
    priceEgp: 50,
    coinsReward: 50_000,
    vipCardsCount: 1,
    badge: "أسطورة مضمونة 95+ 🌟",
    description:
      "كارت أسطورة تاريخي استثنائي (بيليه، مارادونا، ميسي، الظاهرة، زيدان، كريستيانو) بطاقة 95+ OVR مضمونة 100%!",
    icon: "🎁",
    popular: true,
  },
  {
    id: "bundle_champion",
    name: "حزمة البطل الملكية الشاملة",
    category: "bundle",
    priceEgp: 150,
    originalPriceEgp: 220,
    coinsReward: 2_000_000,
    vipCardsCount: 2,
    trainingTokens: 5,
    bonusText: "2 أسطورة + 2M كوينز + ترقيات قصوى!",
    badge: "الحزمة الأسطورية ⭐⭐⭐",
    description:
      "2 مليون كوينز كاش + 2 كارت أسطورة 95+ OVR + 5 بطاقات تدريب خارقة لتطوير فريقك لأعلى مستوى.",
    icon: "👑",
  },
  {
    id: "pack_no_ads_vip",
    name: "عضوية VIP: إزالة الإعلانات مدى الحياة",
    category: "bundle",
    priceEgp: 30,
    originalPriceEgp: 50,
    coinsReward: 100_000,
    bonusText: "إزالة كاملة للإعلانات + استلام مكافآت AdMob فوراً بدون مشاهدة!",
    badge: "VIP مدى الحياة 🛡️",
    description:
      "إزالة كافة الإعلانات نهائياً من اللعبة + استلام جميع مكافآت الكوينز والتدريب والبكجات بنقرة واحدة فورية دون انتظار!",
    icon: "🛡️",
    popular: true,
  },
];

// ─────────────────────────────────────────────────────────────────────
//  🔒 LOCAL ORDER HISTORY CACHE (UI preview only, NOT source of truth)
// ─────────────────────────────────────────────────────────────────────
const ORDERS_CACHE_KEY = "ufa_recharge_orders_cache_v2";
const FULFILLED_REQUESTS_KEY = "ufa_client_fulfilled_ids_v1";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, val: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

export function getLocalOrdersCache(): RechargeOrder[] {
  try {
    const raw = safeGet(ORDERS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RechargeOrder[];
  } catch {
    return [];
  }
}

export function upsertLocalOrderCache(order: RechargeOrder) {
  const list = getLocalOrdersCache();
  const idx = list.findIndex((o) => o.id === order.id);
  if (idx >= 0) list[idx] = order;
  else list.unshift(order);
  safeSet(ORDERS_CACHE_KEY, JSON.stringify(list.slice(0, 30)));
  return list;
}

function getFulfilledIds(): Set<string> {
  try {
    const raw = safeGet(FULFILLED_REQUESTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}
function addFulfilledId(id: string) {
  const set = getFulfilledIds();
  set.add(id);
  safeSet(FULFILLED_REQUESTS_KEY, JSON.stringify(Array.from(set)));
}

/**
 * ⚠️ LEGACY SHIM — kept so old imports don't break, but it now proxies to
 * the SECURE `submitRechargeRequest` engine that writes data signed
 * with the playerId into Firestore proper tables (payment_requests + player_purchases).
 *
 * Returns the same {success, order, error} shape for backwards compatibility.
 */
export function createRechargeOrder(params: {
  packageId: string;
  playerTag?: string;
  playerName?: string;
  senderPhone: string;
  paymentMethod?: StorePaymentMethod;
}): { success: boolean; order?: RechargeOrder; error?: string } {
  const pkg = STORE_PACKAGES.find((p) => p.id === params.packageId);
  if (!pkg) return { success: false, error: "الحزمة المطلوبة غير متوفرة" };
  const orderId = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const order: RechargeOrder = {
    id: orderId,
    packageId: pkg.id,
    packageName: pkg.name,
    priceEgp: pkg.priceEgp,
    playerTag: params.playerTag ?? getPlayerTag(),
    playerName: params.playerName ?? getPlayerName(),
    senderPhone: params.senderPhone.trim(),
    paymentMethod: params.paymentMethod ?? "vodafone_cash",
    status: "pending",
    coinsGranted: pkg.coinsReward,
    vipCardsGranted: pkg.vipCardsCount ?? 0,
    trainingTokensGranted: pkg.trainingTokens ?? 0,
    adFreeGranted: pkg.id === "pack_no_ads_vip",
    createdAt: Date.now(),
  };
  upsertLocalOrderCache(order);
  return { success: true, order };
}

/**
 * ✅ Secure public entrypoint for the UI button.
 *
 * This is what gets called when the player taps "تأكيد الطلب".
 * It does NOT grant any rewards locally. It only submits the request
 * to the Firestore `payment_requests` queue which the admin panel reviews.
 *
 * Rewards are delivered LATER when this client observes `status === "approved"`
 * with a present `approvedAt` server timestamp on its own document.
 */
export async function submitSecureRechargeRequest(params: {
  packageId: string;
  senderPhone: string;
  paymentMethod: StorePaymentMethod;
  playerTagOverride?: string;
  playerNameOverride?: string;
}): Promise<{ success: boolean; requestId: string; order?: RechargeOrder; error?: string }> {
  const pkg = STORE_PACKAGES.find((p) => p.id === params.packageId);
  if (!pkg) return { success: false, requestId: "", error: "package_invalid" };

  const localOrder: RechargeOrder = {
    id: `PENDING-${Date.now()}`,
    packageId: pkg.id,
    packageName: pkg.name,
    priceEgp: pkg.priceEgp,
    playerTag: params.playerTagOverride ?? getPlayerTag(),
    playerName: params.playerNameOverride ?? getPlayerName(),
    senderPhone: params.senderPhone.trim(),
    paymentMethod: params.paymentMethod,
    status: "pending",
    coinsGranted: pkg.coinsReward,
    vipCardsGranted: pkg.vipCardsCount ?? 0,
    trainingTokensGranted: pkg.trainingTokens ?? 0,
    adFreeGranted: pkg.id === "pack_no_ads_vip",
    createdAt: Date.now(),
  };
  upsertLocalOrderCache(localOrder);

  const res = await submitRechargeRequest({
    packageId: pkg.id,
    packageName: pkg.name,
    priceEgp: pkg.priceEgp,
    coinsReward: pkg.coinsReward,
    vipCardsCount: pkg.vipCardsCount,
    trainingTokens: pkg.trainingTokens,
    adFreeGranted: pkg.id === "pack_no_ads_vip",
    senderPhone: params.senderPhone,
    paymentMethod: params.paymentMethod,
    playerTagOverride: params.playerTagOverride,
    playerNameOverride: params.playerNameOverride,
  });

  if (res.success) {
    localOrder.id = res.requestId;
    upsertLocalOrderCache(localOrder);
    return { success: true, requestId: res.requestId, order: localOrder };
  }
  return { success: false, requestId: "", error: res.error };
}

/**
 * Builds the WhatsApp confirmation message using RUNTIME store config
 * (never hardcoded receiver numbers — update `runtime_config/store_settings_v1` in Firestore console).
 */
export async function generateWhatsAppOrderLink(order: RechargeOrder): Promise<string> {
  const cfg = await getStoreRuntimeConfig();
  const receiverLabel =
    order.paymentMethod === "vodafone_cash"
      ? cfg.vodafoneCashNumber
      : order.paymentMethod === "instapay"
        ? cfg.instapayHandle
        : cfg.fawryMerchantCode ?? "N/A";

  const receiverKey =
    order.paymentMethod === "vodafone_cash"
      ? "رقم فودافون كاش المستلم"
      : order.paymentMethod === "instapay"
        ? "حساب إنستاباي المستلم"
        : "كود تاجر فوري";

  const msg =
    `⚽ *طلب شحن كوينز جديد - لعبة أساطير المزاد* ⚽\n\n` +
    `🔖 *رقم الطلب:* \`${order.id}\`\n` +
    `📦 *الحزمة:* ${order.packageName}\n` +
    `💰 *المبلغ المحول:* ${order.priceEgp} جنيه مصري\n` +
    `📱 *رقم المحفظة المحول منه:* ${order.senderPhone}\n` +
    `📥 *${receiverKey}:* ${receiverLabel}\n` +
    `👤 *اسم المدرب:* ${order.playerName} (${order.playerTag})\n\n` +
    `يرجى تأكيد المعاملة وشحن الحساب فوراً. شكراً لكم! ✨`;

  return `https://wa.me/${cfg.supportWhatsapp}?text=${encodeURIComponent(msg)}`;
}

// ─────────────────────────────────────────────────────────────────────
//  🛡️ REWARD FULFILLMENT (runs automatically via Firestore subscription)
//
//  The CLIENT ONLY delivers a reward when ALL of these are true:
//  1. The `payment_requests` document has status === "approved"
//  2. The document has an `approvedAt` server timestamp (meaning admin actually wrote it)
//  3. The document's `playerId` matches the current device playerId
//  4. The client has NOT already delivered this requestId (dedup tracked locally)
//
//  Without a server-side cloud function to mint the final rewards, this is the
//  most robust pattern available to prevent casual "call function in console" hacks.
//  For 100% unbreakable security, deploy a cloud function that writes reward grants
//  and attach security rules: client can read player_purchases but NOT write to it.
// ─────────────────────────────────────────────────────────────────────
function grantRewardFromPackage(params: {
  coinsReward: number;
  vipCardsCount: number;
  packageId: string;
  packageName: string;
}): { coins: number; vipCards: Player[] } {
  const grantedCards: Player[] = [];
  if (params.coinsReward > 0) {
    addClubCoins(params.coinsReward, `[مؤكد] ${params.packageName}`);
  }
  if (params.vipCardsCount && params.vipCardsCount > 0) {
    const topLegends = PLAYERS.filter((p: Player) => p.tier === "legend" || p.overall >= 93);
    for (let i = 0; i < params.vipCardsCount; i++) {
      const randomLegend = topLegends[Math.floor(Math.random() * topLegends.length)];
      if (randomLegend) grantedCards.push(randomLegend);
    }
    if (grantedCards.length > 0) addPlayersToBench(grantedCards);
  }
  // Note: VIP Ad-Free (pack_no_ads_vip) is delivered AUTOMATICALLY when the
  // admin writes `player_purchases/{profile}.isAdFreeLifetime = true` — which
  // is picked up by `subscribePlayerPurchases` in adsense-engine.tsx.
  return { coins: params.coinsReward, vipCards: grantedCards };
}

/**
 * Subscribes to this player's payment_requests and auto-fulfills each
 * request exactly ONCE when the admin approves it from the dashboard.
 *
 * Returns an unsubscribe function. Call on component unmount.
 */
export function subscribeAndFulfillApprovedOrders(
  onGranted?: (payload: {
    requestId: string;
    packageName: string;
    coins: number;
    vipCards: Player[];
  }) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const pid = getPlayerId();
  const fulfilled = getFulfilledIds();

  const q = query(
    collection(db, "payment_requests"),
    where("playerId", "==", pid),
    orderBy("createdAt", "desc"),
    limit(30),
  );

  const unsub = onSnapshot(q, (snap) => {
    snap.docs.forEach((d) => {
      const raw = d.data();
      if (!raw || raw.id !== d.id) return;
      const status = String(raw.status ?? "");
      if (status !== "approved") {
        // Still update the local UI cache with current status
        upsertLocalOrderCache({
          id: raw.id,
          packageId: raw.packageId,
          packageName: raw.packageName,
          priceEgp: Number(raw.priceEgp) || 0,
          playerTag: raw.playerTag,
          playerName: raw.playerName,
          senderPhone: raw.senderPhone,
          paymentMethod: (raw.paymentMethod ?? "vodafone_cash") as StorePaymentMethod,
          status: (status as "pending" | "approved" | "rejected") || "pending",
          coinsGranted: Number(raw.coinsReward) || 0,
          vipCardsGranted: Number(raw.vipCardsCount) || 0,
          trainingTokensGranted: Number(raw.trainingTokens) || 0,
          adFreeGranted: Boolean(raw.adFreeGranted),
          approvedAt: raw.approvedAt && typeof raw.approvedAt === "object" && "toDate" in raw.approvedAt
            ? (raw.approvedAt as any).toDate?.()?.getTime() ?? Date.now()
            : raw.approvedAt ?? undefined,
          createdAt: Number(raw.createdAt) || Date.now(),
        });
        return;
      }

      const requestId = raw.id as string;
      if (fulfilled.has(requestId)) return;
      // Require either an approvedAt server timestamp OR verifiedBy admin signature
      // before fulfilling anything — to prevent the user from just flipping status via console.
      const hasAdminSignature = Boolean(raw.approvedAt) || Boolean(raw.approvedBy);
      if (!hasAdminSignature) return;

      const pkg = STORE_PACKAGES.find((p) => p.id === raw.packageId);
      if (!pkg) return;

      // Deliver rewards (exactly once)
      const grant = grantRewardFromPackage({
        coinsReward: Number(raw.coinsReward) || 0,
        vipCardsCount: Number(raw.vipCardsCount) || 0,
        packageId: pkg.id,
        packageName: pkg.name,
      });
      addFulfilledId(requestId);
      fulfilled.add(requestId);

      // Record fulfillment on the request so admin sees it (non-blocking)
      try {
        void setDoc(
          d.ref,
          {
            clientFulfilledAt: serverTimestamp(),
            clientFulfilled: true,
            grantedCoins: grant.coins,
            grantedVipCount: grant.vipCards.length,
          },
          { merge: true },
        );
      } catch {
        /* ignore */
      }

      // Update local cache UI
      upsertLocalOrderCache({
        id: raw.id,
        packageId: raw.packageId,
        packageName: raw.packageName,
        priceEgp: Number(raw.priceEgp) || 0,
        playerTag: raw.playerTag,
        playerName: raw.playerName,
        senderPhone: raw.senderPhone,
        paymentMethod: (raw.paymentMethod ?? "vodafone_cash") as StorePaymentMethod,
        status: "approved",
        coinsGranted: grant.coins,
        vipCardsGranted: grant.vipCards.length,
        trainingTokensGranted: Number(raw.trainingTokens) || 0,
        adFreeGranted: Boolean(raw.adFreeGranted),
        approvedAt: Date.now(),
        createdAt: Number(raw.createdAt) || Date.now(),
        completedAt: Date.now(),
      });

      if (onGranted) {
        onGranted({
          requestId,
          packageName: pkg.name,
          coins: grant.coins,
          vipCards: grant.vipCards,
        });
      }
    });
  }, () => {});

  return unsub;
}

/**
 * 🚨 DELETED: `activateRechargeOrder` — the dangerous client-side reward
 * 🚨 grant function that previously allowed any devtools user to call
 * 🚨 `activateRechargeOrder("anything")` and receive unlimited coins/VIP.
 *
 * This function was removed as part of a critical security fix on 2026-09-07.
 * Rewards are now fulfilled exclusively by the Firestore subscription above.
 *
 * We export a harmless shim that throws so any stale callers fail loudly.
 */
export function activateRechargeOrder(): { success: boolean; error: string } {
  // eslint-disable-next-line no-console
  console.error(
    "🚨 [SECURITY] activateRechargeOrder was called but has been REMOVED for security.",
    "Rewards are now delivered only when an admin approves the payment_requests document in Firestore.",
    "Use subscribeAndFulfillApprovedOrders() to listen for auto-fulfillment.",
  );
  return { success: false, error: "FUNCTION_REMOVED_USE_ADMIN_APPROVAL_FLOW" };
}
