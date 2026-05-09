// Studio Baeks 공식 8색 팔레트 — H(hue), C500(slot 500의 chroma 상한)
export const palette = {
  terracotta: { H: 30,  C500: 0.165 },  // 토기 — default primary
  rust:       { H: 18,  C500: 0.155 },  // 녹슨 적 — error
  mustard:    { H: 75,  C500: 0.140 },  // 황토 — warning
  sage:       { H: 130, C500: 0.110 },  // 세이지 — success
  mauve:      { H: 340, C500: 0.115 },  // 빛바랜 장미
  teal:       { H: 200, C500: 0.115 },  // 청동
  sky:        { H: 235, C500: 0.080 },  // 슬레이트 — info
  stone:      { H: 75,  C500: 0.010 },  // 종이 그림자 — neutral
} as const;

export type PaletteName = keyof typeof palette;
export type SlotName = 100 | 200 | 400 | 500 | 600 | 700;

// L curve & C ratio: terracotta 실측 기반 (slot 500=1.000, 600=0.958, 700=0.788)
const L_BY_SLOT: Record<SlotName, number> = {
  100: 0.95, 200: 0.90, 400: 0.72, 500: 0.56, 600: 0.46, 700: 0.36,
};
const C_RATIO_BY_SLOT: Record<SlotName, number> = {
  100: 0.133, 200: 0.273, 400: 0.715, 500: 1.000, 600: 0.958, 700: 0.788,
};

export function oklchSlot(name: PaletteName, slot: SlotName): string {
  const seed = palette[name];
  const L = L_BY_SLOT[slot];
  const C = +(seed.C500 * C_RATIO_BY_SLOT[slot]).toFixed(4);
  return `oklch(${L} ${C} ${seed.H})`;
}

export function isPaletteName(s: string): s is PaletteName {
  return s in palette;
}

const HEX_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN_RE = /^(oklch|oklab|rgb|rgba|hsl|hsla|color|hwb|lab|lch)\s*\(/i;

export function validatePrimary(s: string | undefined): { valid: boolean; reason?: string } {
  if (!s) return { valid: true };
  if (isPaletteName(s)) return { valid: true };
  if (HEX_RE.test(s)) return { valid: true };
  if (COLOR_FN_RE.test(s)) return { valid: true };
  const names = Object.keys(palette).join(', ');
  return {
    valid: false,
    reason: `Invalid primary "${s}". Use a named palette (${names}), a hex (e.g. #C8442A), or a CSS color function (e.g. oklch(0.56 0.165 30)).`,
  };
}

export function resolvePrimary(
  primary: string | undefined,
  primaryDark: string | undefined,
): { s500: string; s600: string } {
  // Default → terracotta
  if (!primary) {
    return {
      s500: oklchSlot('terracotta', 500),
      s600: primaryDark ?? oklchSlot('terracotta', 600),
    };
  }
  // Named palette
  if (isPaletteName(primary)) {
    return {
      s500: oklchSlot(primary, 500),
      s600: primaryDark ?? oklchSlot(primary, 600),
    };
  }
  // Hex / CSS color function — passthrough (caller must have validated)
  return { s500: primary, s600: primaryDark ?? primary };
}
