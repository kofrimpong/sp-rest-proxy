
export interface IBasicOAuthOption {
  clientId: string;
  tenantId: string;
}

export interface IOnlineAappOnlyCredentials extends IBasicOAuthOption {
  clientSecret: string;
  authMethod?: 'appOnly';
}

export interface IDeviceCodeCredentials extends IBasicOAuthOption {
  clientSecret?: string; // Optional: for confidential clients
  authMethod?: 'deviceCode';
}

export interface IInteractiveBrowserCredentials extends IBasicOAuthOption {
  redirectPort?: number | string; // Port on localhost to listen on (default: 5000)
  clientSecret: string;
  authMethod?: 'interactive';
}

/**
 * Base interface for custom authentication credentials.
 * Extend this interface when creating custom auth methods.
 * @example
 * ```typescript
 * interface IMyCertCredentials extends ICustomAuthCredentials {
 *   certificatePath: string;
 *   authMethod: 'myCert';
 * }
 * ```
 */
export interface ICustomAuthCredentials {
  authMethod: string;
  [key: string]: any;
}

export type IAuthOptions =
  | IOnlineAappOnlyCredentials
  | IDeviceCodeCredentials
  | IInteractiveBrowserCredentials
  | ICustomAuthCredentials;


export function isDeviceCode(T: IAuthOptions): T is IDeviceCodeCredentials {
  const opts = T as IDeviceCodeCredentials;
  return opts.authMethod === 'deviceCode';
}

export function isInteractiveBrowser(T: IAuthOptions): T is IInteractiveBrowserCredentials {
  const opts = T as IInteractiveBrowserCredentials;
  return opts.authMethod === 'interactive';
}

export function isAppOnlyOnline(T: IAuthOptions): T is IOnlineAappOnlyCredentials {
  const opts = T as IOnlineAappOnlyCredentials;
  return opts.authMethod === 'appOnly';
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