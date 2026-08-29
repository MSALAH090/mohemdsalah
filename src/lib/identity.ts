const KEY = "ufa-player-id";
const NAME_KEY = "ufa-player-name";
const TAG_KEY = "ufa-player-tag";
const FRIENDS_KEY = "ufa-friends";

const memory: Record<string, string> = {};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory[key] ?? null;
  }
}

function safeSet(key: string, value: string) {
  memory[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
}

/** يعمل على كل إصدارات أندرويد/iOS حتى لو crypto.randomUUID غير مدعوم */
export function makeId(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    if (c && typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** توليد سيريال مرئي قصير من 4-5 خانات هيكس للاعب (مثل #84A2F) */
function makeTag(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let tag = "#";
  for (let i = 0; i < 5; i++) {
    tag += chars[Math.floor(Math.random() * chars.length)];
  }
  return tag;
}

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = safeGet(KEY);
  if (!id || id.length < 6) {
    id = makeId();
    safeSet(KEY, id);
  }
  return id;
}

/** السيريال الثابت الظاهر للاعب (مثل #84A2F) */
export function getPlayerTag(): string {
  if (typeof window === "undefined") return "#????";
  let tag = safeGet(TAG_KEY);
  if (!tag || tag.length < 4) {
    tag = makeTag();
    safeSet(TAG_KEY, tag);
  }
  return tag;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return safeGet(NAME_KEY) ?? "";
}

export function setPlayerName(name: string) {
  if (typeof window !== "undefined") safeSet(NAME_KEY, name);
}

/** ======= نظام الأصدقاء ======= */
export interface Friend {
  tag: string;   // السيريال مثل #84A2F
  name: string;  // اسم الصديق
  addedAt: number;
}

export function getFriends(): Friend[] {
  try {
    const raw = safeGet(FRIENDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Friend[];
  } catch {
    return [];
  }
}

export function addFriend(tag: string, name: string): Friend[] {
  const friends = getFriends();
  const normalizedTag = tag.trim().toUpperCase();
  if (!normalizedTag.startsWith("#") || normalizedTag.length < 3) {
    throw new Error("سيريال غير صحيح — يبدأ بـ # ويليه أحرف");
  }
  if (normalizedTag === getPlayerTag()) throw new Error("لا يمكنك إضافة نفسك!");
  const existing = friends.find((f) => f.tag === normalizedTag);
  if (existing) {
    // تحديث الاسم فقط
    existing.name = name || existing.name;
    safeSet(FRIENDS_KEY, JSON.stringify(friends));
    return friends;
  }
  const newFriend: Friend = { tag: normalizedTag, name: name || normalizedTag, addedAt: Date.now() };
  const updated = [newFriend, ...friends];
  safeSet(FRIENDS_KEY, JSON.stringify(updated));
  return updated;
}

export function removeFriend(tag: string): Friend[] {
  const updated = getFriends().filter((f) => f.tag !== tag.toUpperCase());
  safeSet(FRIENDS_KEY, JSON.stringify(updated));
  return updated;
}
