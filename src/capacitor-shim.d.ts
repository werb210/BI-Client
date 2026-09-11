declare module "@capacitor/core" { /* BI_CLIENT_SCANNER_AVAILABILITY_v165 — isPluginAvailable is how a plugin that
   was not linked into the binary is detected at runtime. */
  export const Capacitor: { isNativePlatform(): boolean; convertFileSrc(path: string): string; getPlatform(): string; isPluginAvailable(name: string): boolean }; }
declare module "@capacitor/preferences" { export const Preferences: { get(o:{key:string}):Promise<{value:string|null}>; set(o:{key:string,value:string}):Promise<void>; remove(o:{key:string}):Promise<void> }; }
declare module "@aparajita/capacitor-secure-storage" { export const SecureStorage: { get(key:string):Promise<unknown>; set(key:string,value:string):Promise<void>; remove(key:string):Promise<void> }; }
type CapHandle = { remove(): Promise<void> };
declare module "@capacitor/app" { export const App: { addListener(name:string, cb:(event:any)=>void):Promise<CapHandle>; exitApp():Promise<void> }; }
declare module "@capacitor/keyboard" {
  export enum KeyboardResize { Body="body", Ionic="ionic", Native="native", None="none" }
  export const Keyboard: { setAccessoryBarVisible(o:{isVisible:boolean}):Promise<void> };
}
declare module "@capacitor/status-bar" { export enum Style { Light="LIGHT", Dark="DARK", Default="DEFAULT" } export const StatusBar:{setStyle(o:{style:Style}):Promise<void>}; }
declare module "@capacitor/network" {
  type NetworkStatus = { connected: boolean };
  type ListenerHandle = { remove(): Promise<void> };
  export const Network: {
    getStatus(): Promise<NetworkStatus>;
    addListener(event: "networkStatusChange", listener: (status: NetworkStatus) => void): Promise<ListenerHandle>;
  };
}
declare module "@capacitor/camera" { export enum CameraResultType { Uri="uri" } export enum CameraSource { Photos="PHOTOS", Camera="CAMERA" } export const Camera:{getPhoto(o:any):Promise<{webPath?:string,format:string}>}; }
declare module "@capawesome/capacitor-file-picker" { export const FilePicker:{pickFiles(o:any):Promise<{files:Array<{name:string,mimeType?:string,size?:number,path?:string}>}>}; }
declare module "@capacitor/push-notifications" { export const PushNotifications:{addListener(name:string,cb:(event:any)=>void):Promise<CapHandle>;checkPermissions():Promise<{receive:string}>;register():Promise<void>}; }
