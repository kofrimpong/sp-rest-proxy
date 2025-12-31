
export interface IBasicOAuthOption {
  clientId: string;
}

export interface IOnlineAappOnlyCredentials extends IBasicOAuthOption {
  clientSecret: string;
  tenantId: string;
  authMethod?: 'appOnly';
}

export interface IDeviceCodeCredentials extends IBasicOAuthOption {
  tenantId: string;
  clientSecret?: string; // Optional: for confidential clients
  deviceFlow?: true; // Legacy flag - deprecated in favor of authMethod
  authMethod?: 'deviceCode';
}

export interface IInteractiveBrowserCredentials extends IBasicOAuthOption {
  tenantId: string;
  redirectUri?: string; // Default: http://localhost:5000
  clientSecret?: string; // May exist in config but ignored for interactive flow
  authMethod?: 'interactive';
}

export type IAuthOptions =
  | IOnlineAappOnlyCredentials
  | IDeviceCodeCredentials
  | IInteractiveBrowserCredentials;


export function isDeviceCode(T: IAuthOptions): T is IDeviceCodeCredentials {
  const opts = T as IDeviceCodeCredentials;
  // Check explicit authMethod first
  if (opts.authMethod === 'deviceCode') return true;
  // Fall back to legacy deviceFlow flag
  return opts.deviceFlow === true;
}

export function isInteractiveBrowser(T: IAuthOptions): T is IInteractiveBrowserCredentials {
  const opts = T as IInteractiveBrowserCredentials;
  // Check explicit authMethod first
  if (opts.authMethod === 'interactive') return true;
  // Legacy detection: has tenantId, no deviceFlow, no clientSecret
  return opts.tenantId !== undefined &&
         (T as IDeviceCodeCredentials).deviceFlow !== true &&
         (T as IOnlineAappOnlyCredentials).clientSecret === undefined;
}

export function isAppOnlyOnline(T: IAuthOptions): T is IOnlineAappOnlyCredentials {
  const opts = T as IOnlineAappOnlyCredentials;
  // Check explicit authMethod first
  if (opts.authMethod === 'appOnly') return true;
  // Legacy detection: has clientSecret and no deviceFlow
  return opts.clientSecret !== undefined &&
         (T as IDeviceCodeCredentials).deviceFlow !== true &&
         opts.authMethod === undefined; // Only use legacy detection if authMethod is not set
}


export interface IAuthContext {
  siteUrl: string;
  authOptions: IAuthOptions;
  custom?: any;
  settings?: IAuthConfigSettings;
}

export interface IAuthContextSettings {
  siteUrl: string;
  [name: string]: any;
}


export interface IAuthConfigSettings {
  configPath?: string;
  defaultConfigPath?: string;
  encryptPassword?: boolean;
  saveConfigOnDisk?: boolean;
  authOptions?: IAuthOptions;
  forcePrompts?: boolean;
  masterKey?: string;
  headlessMode?: boolean;
}