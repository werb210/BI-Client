// BI_CLIENT_SPLASH_RECURSION_v1
import { describe, expect, it } from "vitest";
import config from "../../capacitor.config";

describe("splash screen cannot hang the app", () => {
  it("never runs showOnLaunch, which is where the recursion starts", () => {
    // Any non-zero duration registers the KVO observers that re-enter.
    expect(config.plugins?.SplashScreen?.launchShowDuration).toBe(0);
  });

  it("does not depend on JS to dismiss", () => {
    // launchAutoHide:false made dismissal require NativeBridge.tsx calling
    // hide(), which cannot happen if the plugin crashed during load().
    expect(config.plugins?.SplashScreen?.launchAutoHide).toBe(true);
  });

  it("leaves the rest of the plugin config untouched", () => {
    // KeyboardResize.Native === "native", so this assertion is unchanged by
    // the enum fix -- the runtime value was always right, only the type was
    // unchecked because nothing imported this file into the tsc program.
    expect(config.plugins?.Keyboard?.resize).toBe("native");
  });

  it("declares the android scheme where Capacitor actually reads it", () => {
    // Previously `android: { scheme }`, which is not a valid key and was
    // silently discarded.
    expect(config.server?.androidScheme).toBe("https");
  });
});
