export interface IBasicAuthOption {
  authMethod: string;
}

export interface IBasicOAuthOption extends IBasicAuthOption{
  clientId: string;
}

export interface IOnlineAappOnlyCredentials extends IBasicOAuthOption {
  tenantId: string;
  pfxCertificatePath: string;
  certificatePassword?: string;
  shaThumbprint: string; // Optional: x5t (SHA-1 thumbprint) - will be calculated if not provided
  authMethod: 'appOnly';
}

export interface IDeviceCodeCredentials extends IBasicOAuthOption {
  tenantId: string;
  clientSecret?: string; // Optional: for confidential clients
  authMethod: 'deviceCode';
}

export interface IInteractiveBrowserCredentials extends IBasicOAuthOption {
  tenantId: string;
  redirectPort?: number | string; // Port on localhost to listen on (default: 5000)
  clientSecret: string;
  authMethod: 'interactive';
}

export interface IOnPremiseAddinCredentials extends IBasicOAuthOption {
  realm: string;
  issuerId: string;
  rsaPrivateKeyPath: string;
  shaThumbprint: string;
  authMethod: 'onPremiseAddin';
}

export interface IOnpremiseUserCredentials  extends IBasicAuthOption {
  domain?: string;
  workstation?: string;
  rejectUnauthorized?: boolean;
  authMethod: 'onPremiseUserCredentials';
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
export interface ICustomAuthCredentials extends IBasicAuthOption {
  [key: string]: any;
}

export type IAuthOptions =
  | IOnlineAappOnlyCredentials
  | IDeviceCodeCredentials
  | IInteractiveBrowserCredentials
  | IOnPremiseAddinCredentials
  | IOnpremiseUserCredentials
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

export function isOnPremiseAddinOnly(T: IAuthOptions): T is IOnPremiseAddinCredentials {
  const opts = T as IOnPremiseAddinCredentials;
  return opts.authMethod === 'onPremiseAddin';
}

export function isOnpremiseUserCredentials(T: IAuthOptions): T is IOnpremiseUserCredentials {
  const opts = T as IOnpremiseUserCredentials;
  return opts.authMethod === 'onPremiseUserCredentials';
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

export interface ITokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}