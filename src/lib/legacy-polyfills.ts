/**
 * Polyfills for older mobile browsers (Huawei Browser / old Android WebView,
 * older iOS Safari). Imported as early as possible so bundled dependencies
 * that rely on these APIs do not throw before the app renders.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = globalThis as any;

// Array.prototype.at / String.prototype.at (Chrome 92+)
if (typeof Array.prototype.at !== "function") {
  Object.defineProperty(Array.prototype, "at", {
    value: function (n: number) {
      const i = Math.trunc(n) || 0;
      return this[i < 0 ? this.length + i : i];
    },
    writable: true,
    configurable: true,
  });
}
if (typeof String.prototype.at !== "function") {
  Object.defineProperty(String.prototype, "at", {
    value: function (n: number) {
      const i = Math.trunc(n) || 0;
      return this[i < 0 ? this.length + i : i];
    },
    writable: true,
    configurable: true,
  });
}

// Object.hasOwn (Chrome 93+)
if (typeof (Object as any).hasOwn !== "function") {
  (Object as any).hasOwn = (obj: object, key: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, key);
}

// String.prototype.replaceAll (Chrome 85+)
if (typeof String.prototype.replaceAll !== "function") {
  Object.defineProperty(String.prototype, "replaceAll", {
    value: function (search: any, replace: any) {
      if (search instanceof RegExp) return this.replace(search, replace);
      return this.split(search).join(replace);
    },
    writable: true,
    configurable: true,
  });
}

// structuredClone (Chrome 98+)
if (typeof g.structuredClone !== "function") {
  g.structuredClone = (value: any) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };
}

// Promise.any (Chrome 85+)
if (typeof (Promise as any).any !== "function") {
  (Promise as any).any = (promises: Iterable<any>) =>
    new Promise((resolve, reject) => {
      const list = Array.from(promises);
      let pending = list.length;
      if (pending === 0) reject(new Error("All promises were rejected"));
      const errors: any[] = [];
      list.forEach((p, i) => {
        Promise.resolve(p).then(resolve, (err) => {
          errors[i] = err;
          pending -= 1;
          if (pending === 0) reject(new Error("All promises were rejected"));
        });
      });
    });
}

// Array.prototype.findLast / findLastIndex (Chrome 97+)
if (typeof (Array.prototype as any).findLast !== "function") {
  Object.defineProperty(Array.prototype, "findLast", {
    value: function (cb: any, thisArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (cb.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    },
    writable: true,
    configurable: true,
  });
}
if (typeof (Array.prototype as any).findLastIndex !== "function") {
  Object.defineProperty(Array.prototype, "findLastIndex", {
    value: function (cb: any, thisArg?: any) {
      for (let i = this.length - 1; i >= 0; i--) {
        if (cb.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    },
    writable: true,
    configurable: true,
  });
}

// crypto.randomUUID (Chrome 92+)
if (g.crypto && typeof g.crypto.randomUUID !== "function") {
  g.crypto.randomUUID = () => {
    const bytes =
      typeof g.crypto.getRandomValues === "function"
        ? g.crypto.getRandomValues(new Uint8Array(16))
        : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

// Promise.allSettled (Chrome 76+)
if (typeof (Promise as any).allSettled !== "function") {
  (Promise as any).allSettled = (promises: Iterable<any>) =>
    Promise.all(
      Array.from(promises).map((p: any) =>
        Promise.resolve(p).then(
          (value: any) => ({ status: "fulfilled", value }),
          (reason: any) => ({ status: "rejected", reason }),
        ),
      ),
    );
}

// Object.entries (safe guard for very old engines)
if (typeof Object.entries !== "function") {
  (Object as any).entries = (obj: any) =>
    Object.keys(obj).map((k) => [k, obj[k]]);
}

// Object.fromEntries (Chrome 73+)
if (typeof (Object as any).fromEntries !== "function") {
  (Object as any).fromEntries = (entries: Iterable<[any, any]>) => {
    const obj: any = {};
    for (const [k, v] of Array.from(entries)) obj[k] = v;
    return obj;
  };
}

/**
 * Clipboard copy with Huawei / Safari fallback.
 * Usage: safeCopy(text).then(() => ...).catch(() => ...);
 */
export function safeCopy(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text);
  }
  // Old Android WebView / Huawei Browser fallback
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error("copy failed"));
    } catch (e) {
      reject(e);
    }
  });
}

export {};
