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
  new RegExp(`${appTarget[1]}(?: \\/\\*[^*]*\\*\\/)? = \\{isa = XCConfigurationList; buildConfigurations = \\(([^)]*)\\)`),
);
assert(configurationList, "The App target configuration list is missing");
const configurationIds = configurationList[1].match(/\b[A-F0-9]{8,}\b/g) ?? [];
const configurations = configurationIds.map((id) => {
  const match = project.match(new RegExp(`${id}(?: \\/\\*[^*]*\\*\\/)? = \\{isa = XCBuildConfiguration; buildSettings = \\{([^}]*)\\}; name = (Debug|Release);`));
  assert(match, `Cannot read App build configuration ${id}`);
  return { settings: match[1], name: match[2] };
});

assert(configurations.length === 2, "The App target must have Debug and Release configurations");
assert(new Set(configurations.map(({ name }) => name)).size === 2, "The App target must have distinct Debug and Release configurations");
for (const { name, settings } of configurations) {
  assert(settings.includes("PRODUCT_BUNDLE_IDENTIFIER = com.boreal.risk.client;"), `${name} App bundle ID changed`);
  assert(settings.includes('TARGETED_DEVICE_FAMILY = "1,2";'), `${name} App must support iPhone and iPad`);
  assert(settings.includes("SDKROOT = iphoneos;"), `${name} App SDK must be iOS`);
  assert(settings.includes('SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";'), `${name} App must support iOS devices and simulators`);
  assert(settings.includes("SUPPORTS_MACCATALYST = NO;"), `${name} App must not enable Mac Catalyst`);
}

const projectObject = project.match(/PBXProject;[\s\S]*?buildConfigurationList = ([A-F0-9]+)(?: \/\*[^*]*\*\/)?;/);
assert(projectObject, "The Xcode project configuration list is missing");
const projectConfigurationList = project.match(
  new RegExp(`${projectObject[1]}(?: \\/\\*[^*]*\\*\\/)? = \\{isa = XCConfigurationList; buildConfigurations = \\(([^)]*)\\)`),
);
assert(projectConfigurationList, "Cannot read the Xcode project configurations");
const projectConfigurationIds = projectConfigurationList[1].match(/\b[A-F0-9]{8,}\b/g) ?? [];
assert(projectConfigurationIds.length === 2, "The Xcode project must have Debug and Release configurations");
for (const id of projectConfigurationIds) {
  const match = project.match(new RegExp(`${id}(?: \\/\\*[^*]*\\*\\/)? = \\{isa = XCBuildConfiguration; buildSettings = \\{([^}]*)\\}; name = (Debug|Release);`));
  assert(match, `Cannot read Xcode project configuration ${id}`);
  assert(match[1].includes("SDKROOT = iphoneos;"), `${match[2]} project SDK must be iOS`);
  assert(match[1].includes('SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";'), `${match[2]} project must support iOS devices and simulators`);
}

const assertAppResource = (path) => {
  const escapedPath = path.replaceAll(".", "\\.");
  const reference = project.match(new RegExp(`([A-F0-9]+)(?: \\/\\*[^*]*\\*\\/)? = \\{isa = PBXFileReference;[^}]*path = ${escapedPath};`));
  assert(reference, `${path} file reference is missing`);
  const buildFile = project.match(new RegExp(`([A-F0-9]+)(?: \\/\\*[^*]*\\*\\/)? = \\{isa = PBXBuildFile; fileRef = ${reference[1]}`));
  assert(buildFile, `${path} build-file reference is missing`);
  assert(new RegExp(`PBXResourcesBuildPhase;[\\s\\S]*?files = \\([^)]*${buildFile[1]}`).test(project), `${path} is not included in App resources`);
};

assertAppResource("PrivacyInfo.xcprivacy");
assertAppResource("Assets.xcassets");

const localPackage = project.match(/([A-F0-9]+)(?: \/\*[^*]*\*\/)? = \{isa = XCLocalSwiftPackageReference; relativePath = "?CapApp-SPM"?; };/);
assert(localPackage, "CapApp-SPM local package reference is missing");
const packageProduct = project.match(new RegExp(`([A-F0-9]+)(?: \\/\\*[^*]*\\*\\/)? = \\{isa = XCSwiftPackageProductDependency; package = ${localPackage[1]}[^;]*; productName = "?CapApp-SPM"?; };`));
assert(packageProduct, "CapApp-SPM package product dependency is missing");
assert(new RegExp(`packageProductDependencies = \\([^)]*${packageProduct[1]}`).test(appTarget[0]), "CapApp-SPM is not an App target dependency");
const packageBuildFile = project.match(new RegExp(`([A-F0-9]+)(?: \\/\\*[^*]*\\*\\/)? = \\{isa = PBXBuildFile; productRef = ${packageProduct[1]}`));
assert(packageBuildFile, "CapApp-SPM framework build-file reference is missing");
assert(new RegExp(`PBXFrameworksBuildPhase;[\\s\\S]*?files = \\([^)]*${packageBuildFile[1]}`).test(project), "CapApp-SPM is not linked in App frameworks");

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

console.log("iOS platform, package, resources, identity, transport, and secure-storage guardrails passed.");
