// BI_CLIENT_BLOCK_v093_VERIFIER_WHITESPACE_TOLERANT_v1
// Xcode writes pbxproj objects in two equally valid layouts: compact
// (everything on one line) and expanded (one key per line). Commit 501b6bd
// switched this project to expanded and every matcher below, which assumed
// compact, stopped matching -- so the guardrails failed open on the App target
// configuration list. Whitespace between tokens is now `\s*`, so the assertions
// hold under either layout instead of tracking whichever one Xcode last wrote.
import { readFileSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
assert(statSync(new URL(projectPath, root)).isFile(), `${projectPath} is missing`);

const project = read(projectPath);
const appTarget = project.match(/PBXNativeTarget;[\s\S]*?buildConfigurationList = ([A-F0-9]+)(?: \/\*[^*]*\*\/)?;[\s\S]*?name = App;[\s\S]*?};/);
assert(appTarget, "The App native target is missing");

const configurationList = project.match(
  new RegExp(`${appTarget[1]}(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*XCConfigurationList;\\s*buildConfigurations\\s*=\\s*\\(([^)]*)\\)`),
);
assert(configurationList, "The App target configuration list is missing");
const configurationIds = configurationList[1].match(/\b[A-F0-9]{8,}\b/g) ?? [];
const configurations = configurationIds.map((id) => {
  const match = project.match(new RegExp(`${id}(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*XCBuildConfiguration;\\s*buildSettings\\s*=\\s*\\{([^}]*)\\};\\s*name\\s*=\\s*(Debug|Release);`));
  assert(match, `Cannot read App build configuration ${id}`);
  return { settings: match[1], name: match[2] };
});

assert(configurations.length === 2, "The App target must have Debug and Release configurations");
assert(new Set(configurations.map(({ name }) => name)).size === 2, "The App target must have distinct Debug and Release configurations");
const normalise = (settings) => settings.replace(/\s+/g, " ");
for (const { name, settings: rawSettings } of configurations) {
  const settings = normalise(rawSettings);
  assert(settings.includes("PRODUCT_BUNDLE_IDENTIFIER = com.boreal.risk.client;"), `${name} App bundle ID changed`);
  assert(settings.includes('TARGETED_DEVICE_FAMILY = "1,2";'), `${name} App must support iPhone and iPad`);
  assert(settings.includes("SDKROOT = iphoneos;"), `${name} App SDK must be iOS`);
  assert(settings.includes('SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";'), `${name} App must support iOS devices and simulators`);
  assert(settings.includes("SUPPORTS_MACCATALYST = NO;"), `${name} App must not enable Mac Catalyst`);
}

const projectObject = project.match(/PBXProject;[\s\S]*?buildConfigurationList = ([A-F0-9]+)(?: \/\*[^*]*\*\/)?;/);
assert(projectObject, "The Xcode project configuration list is missing");
const projectConfigurationList = project.match(
  new RegExp(`${projectObject[1]}(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*XCConfigurationList;\\s*buildConfigurations\\s*=\\s*\\(([^)]*)\\)`),
);
assert(projectConfigurationList, "Cannot read the Xcode project configurations");
const projectConfigurationIds = projectConfigurationList[1].match(/\b[A-F0-9]{8,}\b/g) ?? [];
assert(projectConfigurationIds.length === 2, "The Xcode project must have Debug and Release configurations");
for (const id of projectConfigurationIds) {
  const match = project.match(new RegExp(`${id}(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*XCBuildConfiguration;\\s*buildSettings\\s*=\\s*\\{([^}]*)\\};\\s*name\\s*=\\s*(Debug|Release);`));
  assert(match, `Cannot read Xcode project configuration ${id}`);
  assert(normalise(match[1]).includes("SDKROOT = iphoneos;"), `${match[2]} project SDK must be iOS`);
  assert(normalise(match[1]).includes('SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";'), `${match[2]} project must support iOS devices and simulators`);
}

const assertAppResource = (path) => {
  const escapedPath = path.replaceAll(".", "\\.");
  const reference = project.match(new RegExp(`([A-F0-9]+)(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*PBXFileReference;[^}]*path\\s*=\\s*${escapedPath};`));
  assert(reference, `${path} file reference is missing`);
  const buildFile = project.match(new RegExp(`([A-F0-9]+)(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*PBXBuildFile;\\s*fileRef\\s*=\\s*${reference[1]}`));
  assert(buildFile, `${path} build-file reference is missing`);
  assert(new RegExp(`PBXResourcesBuildPhase;[\\s\\S]*?files\\s*=\\s*\\([^)]*${buildFile[1]}`).test(project), `${path} is not included in App resources`);
};

assertAppResource("PrivacyInfo.xcprivacy");
assertAppResource("Assets.xcassets");

const localPackage = project.match(/([A-F0-9]+)(?:\s*\/\*[^*]*\*\/)?\s*=\s*\{\s*isa\s*=\s*XCLocalSwiftPackageReference;\s*relativePath\s*=\s*"?CapApp-SPM"?;\s*\};/);
assert(localPackage, "CapApp-SPM local package reference is missing");
const packageProduct = project.match(new RegExp(`([A-F0-9]+)(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*XCSwiftPackageProductDependency;\\s*package\\s*=\\s*${localPackage[1]}[^;]*;\\s*productName\\s*=\\s*"?CapApp-SPM"?;\\s*\\};`));
assert(packageProduct, "CapApp-SPM package product dependency is missing");
assert(new RegExp(`packageProductDependencies\\s*=\\s*\\([^)]*${packageProduct[1]}`).test(appTarget[0]), "CapApp-SPM is not an App target dependency");
const packageBuildFile = project.match(new RegExp(`([A-F0-9]+)(?:\\s*\\/\\*[^*]*\\*\\/)?\\s*=\\s*\\{\\s*isa\\s*=\\s*PBXBuildFile;\\s*productRef\\s*=\\s*${packageProduct[1]}`));
assert(packageBuildFile, "CapApp-SPM framework build-file reference is missing");
assert(new RegExp(`PBXFrameworksBuildPhase;[\\s\\S]*?files\\s*=\\s*\\([^)]*${packageBuildFile[1]}`).test(project), "CapApp-SPM is not linked in App frameworks");

const capacitorConfig = read("capacitor.config.ts");
assert(/appId:\s*["']com\.boreal\.risk\.client["']/.test(capacitorConfig), "Capacitor appId changed");
const mixedContentSetting = new RegExp([
  "allowMixedContent",
  "\\s*:\\s*",
  "true",
].join(""));
assert(!mixedContentSetting.test(capacitorConfig), "Capacitor mixed content must remain disabled");

const packageJson = JSON.parse(read("package.json"));
const lockfile = read("package-lock.json");
assert(packageJson.dependencies?.["@aparajita/capacitor-secure-storage"], "Secure native storage dependency is missing");
assert(lockfile.includes('node_modules/@aparajita/capacitor-secure-storage'), "Secure native storage is missing from the lockfile");
const privateSecurePreferences = ["@capawesome-team", "capacitor-secure-preferences"].join("/");
assert(!lockfile.includes(privateSecurePreferences), "Private secure-preferences package is forbidden");

const swiftPackage = read("ios/App/CapApp-SPM/Package.swift");
const nativePlugins = [
  {
    dependency: "@capacitor/app",
    path: "@capacitor/app",
    packageName: "CapacitorApp",
    product: "CapacitorApp",
  },
  {
    dependency: "@capacitor/app-launcher",
    path: "@capacitor/app-launcher",
    packageName: "CapacitorAppLauncher",
    product: "CapacitorAppLauncher",
  },
  {
    dependency: "@capacitor/camera",
    path: "@capacitor/camera",
    packageName: "CapacitorCamera",
    product: "CapacitorCamera",
  },
  {
    dependency: "@capacitor/device",
    path: "@capacitor/device",
    packageName: "CapacitorDevice",
    product: "CapacitorDevice",
  },
  {
    dependency: "@capacitor/filesystem",
    path: "@capacitor/filesystem",
    packageName: "CapacitorFilesystem",
    product: "CapacitorFilesystem",
  },
  {
    dependency: "@capacitor/keyboard",
    path: "@capacitor/keyboard",
    packageName: "CapacitorKeyboard",
    product: "CapacitorKeyboard",
  },
  {
    dependency: "@capacitor/network",
    path: "@capacitor/network",
    packageName: "CapacitorNetwork",
    product: "CapacitorNetwork",
  },
  {
    dependency: "@capacitor/preferences",
    path: "@capacitor/preferences",
    packageName: "CapacitorPreferences",
    product: "CapacitorPreferences",
  },
  {
    dependency: "@capacitor/push-notifications",
    path: "@capacitor/push-notifications",
    packageName: "CapacitorPushNotifications",
    product: "CapacitorPushNotifications",
  },
  {
    dependency: "@capacitor/splash-screen",
    path: "@capacitor/splash-screen",
    packageName: "CapacitorSplashScreen",
    product: "CapacitorSplashScreen",
  },
  {
    dependency: "@capacitor/status-bar",
    path: "@capacitor/status-bar",
    packageName: "CapacitorStatusBar",
    product: "CapacitorStatusBar",
  },
  {
    dependency: "@capawesome/capacitor-file-picker",
    path: "@capawesome/capacitor-file-picker",
    packageName: "CapawesomeCapacitorFilePicker",
    product: "CapawesomeCapacitorFilePicker",
  },
  {
    dependency: "@aparajita/capacitor-secure-storage",
    path: "@aparajita/capacitor-secure-storage",
    packageName: "AparajitaCapacitorSecureStorage",
    product: "AparajitaCapacitorSecureStorage",
  },
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const linkage = nativePlugins.map((plugin) => {
  const declared = Boolean(packageJson.dependencies?.[plugin.dependency]);
  const packageLinked = new RegExp(
    [
      "\\.package\\(",
      "\\s*name:\\s*\"",
      escapeRegExp(plugin.packageName),
      "\"",
      "\\s*,\\s*",
      "path:\\s*\"[^\"]*node_modules/",
      escapeRegExp(plugin.path),
      "\"",
      "\\s*\\)",
    ].join(""),
  ).test(swiftPackage);
  const productLinked = new RegExp(
    [
      "\\.product\\(",
      "\\s*name:\\s*\"",
      escapeRegExp(plugin.product),
      "\"",
      "\\s*,\\s*",
      "package:\\s*\"",
      escapeRegExp(plugin.packageName),
      "\"",
      "\\s*\\)",
    ].join(""),
  ).test(swiftPackage);
  return { ...plugin, declared, packageLinked, productLinked };
});

console.log("\nPLUGIN                         PACKAGE  PRODUCT  STATUS");
for (const plugin of linkage) {
  const ok = plugin.declared && plugin.packageLinked && plugin.productLinked;
  console.log(
    `${plugin.product.padEnd(30)} ${(plugin.packageLinked ? "yes" : "no").padEnd(7)}  ${(plugin.productLinked ? "yes" : "no").padEnd(7)}  ${ok ? "OK" : "MISSING"}`,
  );
}

const capacitorVersion = JSON.parse(lockfile).packages?.["node_modules/@capacitor/core"]?.version;
assert(capacitorVersion, "Installed Capacitor version is missing from package-lock.json");
assert(
  swiftPackage.includes(`.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "${capacitorVersion}")`),
  `Capacitor SwiftPM must be pinned to the lockfile version (${capacitorVersion})`,
);
assert(swiftPackage.includes('.product(name: "Capacitor", package: "capacitor-swift-pm")'), "Base Capacitor product is not linked");
assert(swiftPackage.includes('.product(name: "Cordova", package: "capacitor-swift-pm")'), "Base Cordova product is not linked");
for (const plugin of linkage) {
  assert(plugin.declared, `${plugin.dependency} is missing from package.json`);
  assert(plugin.packageLinked, `${plugin.dependency} Swift package dependency is missing`);
  assert(plugin.productLinked, `${plugin.product} target product dependency is missing`);
}

console.log("iOS platform, package, resources, identity, transport, and secure-storage guardrails passed.");
