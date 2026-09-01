export const Capacitor = { isNativePlatform: () => false, convertFileSrc: (path: string) => path, getPlatform: () => "web" };
export const Preferences = { get: async () => ({ value: null }), set: async () => undefined, remove: async () => undefined };
export const SecurePreferences = Preferences;
export const App = { addListener: async () => ({ remove: async () => undefined }), exitApp: async () => undefined };
export const Keyboard = { setAccessoryBarVisible: async () => undefined };
export const SplashScreen = { hide: async () => undefined };
export enum Style { Light = "LIGHT" }
export const StatusBar = { setStyle: async () => undefined };
export const Network = { getStatus: async () => ({ connected: true }) };
export enum CameraResultType { Uri = "uri" }
export enum CameraSource { Photos = "PHOTOS", Camera = "CAMERA" }
export const Camera = { getPhoto: async () => ({ format: "jpeg" }) };
export const FilePicker = { pickFiles: async () => ({ files: [] }) };
export const PushNotifications = { addListener: async () => ({ remove: async () => undefined }), checkPermissions: async () => ({ receive: "denied" }), register: async () => undefined };
