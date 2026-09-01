declare module "@capacitor/core" { export const Capacitor: { isNativePlatform(): boolean; convertFileSrc(path: string): string; getPlatform(): string }; }
declare module "@capacitor/preferences" { export const Preferences: { get(o:{key:string}):Promise<{value:string|null}>; set(o:{key:string,value:string}):Promise<void>; remove(o:{key:string}):Promise<void> }; }
declare module "@capawesome-team/capacitor-secure-preferences" { export const SecurePreferences: { get(o:{key:string}):Promise<{value:string|null}>; set(o:{key:string,value:string}):Promise<void>; remove(o:{key:string}):Promise<void> }; }
type CapHandle = { remove(): Promise<void> };
declare module "@capacitor/app" { export const App: { addListener(name:string, cb:(event:any)=>void):Promise<CapHandle>; exitApp():Promise<void> }; }
declare module "@capacitor/keyboard" { export const Keyboard: { setAccessoryBarVisible(o:{isVisible:boolean}):Promise<void> }; }
declare module "@capacitor/splash-screen" { export const SplashScreen: { hide():Promise<void> }; }
declare module "@capacitor/status-bar" { export enum Style { Light="LIGHT", Dark="DARK", Default="DEFAULT" } export const StatusBar:{setStyle(o:{style:Style}):Promise<void>}; }
declare module "@capacitor/network" { export const Network:{getStatus():Promise<{connected:boolean}>}; }
declare module "@capacitor/camera" { export enum CameraResultType { Uri="uri" } export enum CameraSource { Photos="PHOTOS", Camera="CAMERA" } export const Camera:{getPhoto(o:any):Promise<{webPath?:string,format:string}>}; }
declare module "@capawesome/capacitor-file-picker" { export const FilePicker:{pickFiles(o:any):Promise<{files:Array<{name:string,mimeType?:string,size?:number,path?:string}>}>}; }
declare module "@capacitor/push-notifications" { export const PushNotifications:{addListener(name:string,cb:(event:any)=>void):Promise<CapHandle>;checkPermissions():Promise<{receive:string}>;register():Promise<void>}; }
