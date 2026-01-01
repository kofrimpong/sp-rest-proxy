export interface IAuthMethodConfig {
  id: string;
  name: string;
  description: string;
  requiredFields: IFieldConfig[];
  setFlags?: (config: any) => void;
}

export interface IFieldConfig {
  key: string;
  prompt: string;
  secret?: boolean; // Should be encrypted
  optional?: boolean;
}

export const authMethods: IAuthMethodConfig[] = [
  {
    id: 'interactive',
    name: 'Interactive Browser',
    description: 'recommended - supports MFA',
    requiredFields: [
      { key: 'clientId', prompt: 'Client ID' },
      { key: 'tenantId', prompt: 'Tenant ID' },
      { key: 'clientSecret', prompt: 'Client Secret', secret: true },
      { key: 'redirectPort', prompt: 'Redirect port (optional)', optional: true }
    ],
    setFlags: (config) => {
      config.authMethod = 'interactive';
    }
  },
  {
    id: 'deviceCode',
    name: 'Device Code Flow',
    description: 'supports MFA',
    requiredFields: [
      { key: 'clientId', prompt: 'Client ID' },
      { key: 'tenantId', prompt: 'Tenant ID' },
      { key: 'clientSecret', prompt: 'Client Secret', secret: true, optional: true }
    ],
    setFlags: (config) => {
      config.authMethod = 'deviceCode';
    }
  },
  {
    id: 'appOnly',
    name: 'Online App-Only (Certificate)',
    description: 'certificate-based authentication',
    requiredFields: [
      { key: 'clientId', prompt: 'Client ID' },
      { key: 'tenantId', prompt: 'Tenant ID' },
      { key: 'pfxCertificatePath', prompt: 'Certificate Path (.pfx file)' },
      { key: 'shaThumbprint', prompt: 'SHA Thumbprint'},
      { key: 'certificatePassword', prompt: 'Certificate Password', secret: true, optional: true }
    ],
    setFlags: (config) => {
      config.authMethod = 'appOnly';
    }
  },
  {
    id: 'onPremiseAddin',
    name: 'On-Premise Add-in Only',
    description: 'using SharePoint Add-in credentials',
    requiredFields: [
      { key: 'clientId', prompt: 'Client ID' },
      { key: 'realm', prompt: 'Realm' },
      { key: 'issuerId', prompt: 'Issuer ID' },
      { key: 'rsaPrivateKeyPath', prompt: 'RSA Private Key Path' },
      { key: 'shaThumbprint', prompt: 'SHA Thumbprint' }
    ],
    setFlags: (config) => {
      config.authMethod = 'onPremiseAddin';
    }
  },
  {
    id: 'onPremiseUserCredentials',
    name: 'On-Premise User Credentials',
    description: 'using Windows user credentials',
    requiredFields: [
      { key: 'username', prompt: 'Username' },
      { key: 'password', prompt: 'Password', secret: true },
      { key: 'domain', prompt: 'Domain', optional: true },
      { key: 'workstation', prompt: 'Workstation', optional: true },
      { key: 'rejectUnauthorized', prompt: 'Reject Unauthorized SSL (true/false)', optional: true }
    ],
    setFlags: (config) => {
      config.authMethod = 'onPremiseUserCredentials';
    }
  }
];

export function getAuthMethod(id: string): IAuthMethodConfig | undefined {
  return authMethods.find((m) => m.id === id);
}

export function detectAuthMethod(config: any): string | undefined {
  return config.authMethod;
}

/**
 * Register a custom authentication method
 * @param method - The auth method configuration to register
 * @example
 * ```typescript
 * import { registerAuthMethod } from 'sp-rest-proxy/dist/auth/authResolverRegistry';
 *
 * registerAuthMethod({
 *   id: 'myCert',
 *   name: 'Certificate-Based',
 *   description: 'using X.509 certificate',
 *   requiredFields: [
 *     { key: 'clientId', prompt: 'Client ID' },
 *     { key: 'certificatePath', prompt: 'Certificate Path' }
 *   ],
 *   setFlags: (config) => config.authMethod = 'myCert'
 * });
 * ```
 */
export function registerAuthMethod(method: IAuthMethodConfig): void {
  const existing = authMethods.find((m) => m.id === method.id);
  if (existing) {
    console.warn(`Auth method '${method.id}' is already registered. Skipping.`);
    return;
  }
  authMethods.push(method);
}
