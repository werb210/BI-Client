import { readFileSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
assert(statSync(new URL(projectPath, root)).isFile(), `${projectPath} is missing`);

const project = read(projectPath);
const appTarget = project.match(/PBXNativeTarget;[^}]*buildConfigurationList = ([A-F0-9]+);[^}]*name = App;/);
assert(appTarget, "The App native target is missing");

const configurationList = project.match(
  new RegExp(`${appTarget[1]} = \\{isa = XCConfigurationList; buildConfigurations = \\(([^)]*)\\)`),
);
assert(configurationList, "The App target configuration list is missing");
const configurationIds = configurationList[1].match(/[A-F0-9]+/g) ?? [];
const configurations = configurationIds.map((id) => {
  const match = project.match(new RegExp(`${id} = \\{isa = XCBuildConfiguration; buildSettings = \\{([^}]*)\\}; name = (Debug|Release);`));
  assert(match, `Cannot read App build configuration ${id}`);
  return { settings: match[1], name: match[2] };
});

assert(configurations.length === 2, "The App target must have Debug and Release configurations");
assert(new Set(configurations.map(({ name }) => name)).size === 2, "The App target must have distinct Debug and Release configurations");
for (const { name, settings } of configurations) {
  assert(settings.includes("PRODUCT_BUNDLE_IDENTIFIER = com.boreal.risk.client;"), `${name} App bundle ID changed`);
  assert(settings.includes('TARGETED_DEVICE_FAMILY = "1,2";'), `${name} App must support iPhone and iPad`);
}

const privacyReference = project.match(/([A-F0-9]+) = \{isa = PBXFileReference;[^}]*path = PrivacyInfo\.xcprivacy;/);
assert(privacyReference, "PrivacyInfo.xcprivacy file reference is missing");
const privacyBuildFile = project.match(new RegExp(`([A-F0-9]+) = \\{isa = PBXBuildFile; fileRef = ${privacyReference[1]};`));
assert(privacyBuildFile, "PrivacyInfo.xcprivacy build-file reference is missing");
assert(
  new RegExp(`PBXResourcesBuildPhase;[^}]*files = \\([^)]*${privacyBuildFile[1]}`, "s").test(project),
  "PrivacyInfo.xcprivacy is not included in App resources",
);

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

console.log("iOS identity, device-family, privacy, transport, and secure-storage guardrails passed.");
