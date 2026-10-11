// Helpers for the chrome behaviour tests. Importing this module injects the
// real chrome stylesheet into jsdom (vite.config.ts test.css.include), so
// getComputedStyle returns what the stylesheet really gives an element.
//
// jsdom limits these helpers work around:
// - var(--x) is not resolved in normal properties, so `computed` resolves it
//   against the custom properties declared on :root.
// - :hover, :active and :focus-visible cannot be put on an element, and
//   @media rules are not applied by getComputedStyle. `stateRules` and
//   `mediaRules` read the live CSSOM (document.styleSheets) and return the
//   rules that WOULD apply to a rendered element in that state or at that
//   width, by matching the element against the selector.
import "@/components/chrome/chrome.css";
import { parseColor } from "@/theme/palette";

/** A custom property as declared on :root, e.g. cssVar("--boreal-gold"). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Replaces every var(--x) in a value with the :root value of --x. */
export function resolveVars(value: string): string {
  let out = value;
  for (let i = 0; i < 5 && /var\(--[\w-]+\)/.test(out); i++) {
    out = out.replace(/var\((--[\w-]+)\)/g, (_m, name: string) => cssVar(name));
  }
  return out.trim();
}

/** Computed value of a property, with var() resolved. */
export function computed(el: Element, prop: string): string {
  return resolveVars(getComputedStyle(el).getPropertyValue(prop));
}

/** Normalises any hex/rgb colour to the "rgb(r, g, b)" / "rgba(...)" form jsdom reports. */
export function rgb(color: string): string {
  const c = parseColor(color);
  return c.a === 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

/** The colour an element is painted with: background-color, falling back to the background shorthand. */
export function backgroundOf(el: Element): string {
  const cs = getComputedStyle(el);
  const bg = cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : cs.getPropertyValue("background");
  const value = resolveVars(bg);
  try { return rgb(value); } catch { return value; }
}

/** The text colour of an element, normalised to rgb(). */
export function colorOf(el: Element): string {
  const value = computed(el, "color");
  try { return rgb(value); } catch { return value; }
}

function allRules(): CSSRule[] {
  const out: CSSRule[] = [];
  const walk = (list: CSSRuleList) => {
    for (const r of Array.from(list)) {
      out.push(r);
      const inner = (r as CSSGroupingRule).cssRules;
      if (inner) walk(inner);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
  return out;
}

/** Splits a selector list on the commas that separate selectors, not those inside quotes or brackets. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let current = "";
  for (const ch of list) {
    if (quote) { if (ch === quote) quote = ""; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) { out.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function matches(el: Element, selector: string): boolean {
  try { return el.matches(selector); } catch { return false; }
}

function parentCondition(rule: CSSRule): string | null {
  const parent = rule.parentRule as (CSSMediaRule | null);
  return parent && "media" in parent ? parent.media.mediaText : null;
}

/**
 * Declarations of top-level rules that would apply to `el` while it is in
 * `state` (e.g. "hover", "active", "focus-visible", "focus"). A selector
 * qualifies when it names that pseudo-class and, with the pseudo-class
 * removed, matches the element as rendered.
 */
export function stateRules(el: Element, state: string): CSSStyleDeclaration[] {
  const names = new RegExp(`:${state}(?![\\w-])`);
  const strip = new RegExp(`:${state}(?![\\w-])`, "g");
  const out: CSSStyleDeclaration[] = [];
  for (const rule of allRules()) {
    const style = rule as CSSStyleRule;
    if (!style.selectorText || parentCondition(rule)) continue;
    const hit = splitSelectors(style.selectorText).some((sel) => names.test(sel) && matches(el, sel.replace(strip, "").trim()));
    if (hit) out.push(style.style);
  }
  return out;
}

/** Declarations inside `@media (<condition>)` whose selector matches `el`. */
export function mediaRules(el: Element, condition: string): CSSStyleDeclaration[] {
  const out: CSSStyleDeclaration[] = [];
  for (const rule of allRules()) {
    const style = rule as CSSStyleRule;
    if (!style.selectorText || parentCondition(rule) !== condition) continue;
    if (matches(el, style.selectorText)) out.push(style.style);
  }
  return out;
}

/**
 * Declarations of top-level rules that match `el` as rendered, in sheet order.
 * For shorthands jsdom drops from getComputedStyle (e.g. a border that uses
 * var()), declared(matchedRules(el), "border") gives the cascaded value.
 */
export function matchedRules(el: Element): CSSStyleDeclaration[] {
  const out: CSSStyleDeclaration[] = [];
  for (const rule of allRules()) {
    const style = rule as CSSStyleRule;
    if (!style.selectorText || parentCondition(rule)) continue;
    if (matches(el, style.selectorText)) out.push(style.style);
  }
  return out;
}

/** The last value a list of declarations gives a property, var() resolved. */
export function declared(rules: CSSStyleDeclaration[], prop: string): string {
  let value = "";
  for (const r of rules) {
    const v = r.getPropertyValue(prop);
    if (v) value = v;
  }
  return resolveVars(value);
}
