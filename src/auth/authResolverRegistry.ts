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
      { key: 'redirectUri', prompt: 'Redirect URI (optional)', optional: true }
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
      { key: 'tenantId', prompt: 'Tenant ID' }
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
