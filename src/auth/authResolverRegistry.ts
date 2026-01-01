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
    name: 'App-Only',
    description: 'client credentials',
    requiredFields: [
      { key: 'clientId', prompt: 'Client ID' },
      { key: 'tenantId', prompt: 'Tenant ID' },
      { key: 'clientSecret', prompt: 'Client Secret', secret: true }
    ],
    setFlags: (config) => {
      config.authMethod = 'appOnly';
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
