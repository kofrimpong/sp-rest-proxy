import * as fs from 'fs';
import * as path from 'path';
import { Cpass } from 'cpass';
import * as readline from 'readline';

import { IAuthConfigSettings, IAuthContext, IAuthContextSettings, IAuthOptions } from './IAuthOptions';import { authMethods, getAuthMethod, detectAuthMethod, IAuthMethodConfig } from './authResolverRegistry';
export class AuthConfig {

  private settings: IAuthConfigSettings;
  private cpass: Cpass;

  constructor(settings: IAuthConfigSettings = {}) {
    // this.targets = getTargetsTypes();
    const envMode = process.env.SPAUTH_ENV || process.env.NODE_ENV;
    const headlessMode = typeof settings.headlessMode !== 'undefined' ? settings.headlessMode : envMode === 'production';
    this.settings = {
      ...settings,
      configPath: path.resolve(settings.configPath || './config/private.json'),
      encryptPassword: typeof settings.encryptPassword !== 'undefined' ? settings.encryptPassword : true,
      saveConfigOnDisk: typeof settings.saveConfigOnDisk !== 'undefined' ? settings.saveConfigOnDisk : true,
      headlessMode
    };
    if (typeof this.settings.encryptPassword === 'string') {
      this.settings.encryptPassword = !((this.settings.encryptPassword as string).toLowerCase() === 'false');
    }
    // Check if there is a master key in environment variables, #18
    if (process.env.AUTH_MASTER_KEY && !this.settings.masterKey) {
      this.settings.masterKey = process.env.AUTH_MASTER_KEY;
    }
    this.cpass = new Cpass(this.settings.masterKey);
  }

  public getContext = async (): Promise<IAuthContext> => {
    // Check if config file exists
    const { exists, jsonRawData } = this.getJsonContent(this.settings.configPath, this.settings.authOptions);

    if (!exists && !this.settings.authOptions) {
      if (this.settings.headlessMode) {
        throw new Error(`Configuration file not found: ${this.settings.configPath}`);
      }
      // Interactive mode - create new config
      console.log('\n=== SharePoint Authentication Setup ===\n');
      const configData = await this.createNewConfig();
      return this.convertSettingsToAuthContext(configData, this.settings);
    }

    let configData = jsonRawData;

    // Merge with default config if provided
    if (typeof this.settings.defaultConfigPath !== 'undefined') {
      const defaultConfig = this.getJsonContent(this.settings.defaultConfigPath).jsonRawData;
      configData = { ...defaultConfig, ...configData };
    }

    // Validate config has required fields for its auth type
    if (!this.validateConfig(configData)) {
      if (this.settings.headlessMode) {
        const authMethodId = detectAuthMethod(configData);
        if (!authMethodId) {
          throw new Error('Configuration missing authMethod field. Please specify: interactive, deviceCode, or appOnly');
        }
        throw new Error(`Invalid configuration for ${authMethodId} authentication method`);
      }
      console.log('\n=== Configuration Update Required ===\n');
      configData = await this.updateConfig(configData);
    }

    // Decrypt password if present
    const passwordPropertyName = this.getHiddenPropertyName(configData);
    if (configData[passwordPropertyName]) {
      configData[passwordPropertyName] = this.cpass.decode(configData[passwordPropertyName]);
    }

    const authContext = this.convertSettingsToAuthContext(configData, this.settings);
    return authContext;
  }

  private convertSettingsToAuthContext = (configObject: IAuthContextSettings, settings: IAuthConfigSettings = {}): IAuthContext => {
    const formattedContext: IAuthContext = {
      siteUrl: (configObject?.siteUrl || '').split('#')[0] || '',
      authOptions: {
        ...(configObject as any)
      },
      settings,
      custom: configObject.custom
    };
    if (typeof formattedContext.custom === 'undefined') {
      delete formattedContext.custom;
    }
    delete (formattedContext.authOptions as any).siteUrl;
    delete (formattedContext.authOptions as any).strategy;
    delete (formattedContext.authOptions as any).custom;
    return formattedContext;
  }

  private validateConfig = (config: any): boolean => {
    if (!config.siteUrl) return false;

    const authMethodId = detectAuthMethod(config);
    if (!authMethodId) return false;

    const authMethod = getAuthMethod(authMethodId);
    if (!authMethod) return false;

    // Check all required fields are present
    return authMethod.requiredFields
      .filter((f) => !f.optional)
      .every((field) => config[field.key]);
  }

  private selectAuthMethod = async (rl: readline.Interface, question: (prompt: string) => Promise<string>): Promise<IAuthMethodConfig> => {
    console.log('\nAuthentication Methods:');
    authMethods.forEach((method, index) => {
      console.log(`${index + 1}. ${method.name} (${method.description})`);
    });

    const selection = await question(`\nSelect method (1-${authMethods.length}): `);
    const selectedIndex = parseInt(selection) - 1;

    if (selectedIndex < 0 || selectedIndex >= authMethods.length) {
      throw new Error('Invalid selection');
    }

    return authMethods[selectedIndex];
  }

  private createNewConfig = async (): Promise<any> => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer.trim()));
      });
    };

    try {
      const siteUrl = await question('SharePoint site URL: ');

      const authMethod = await this.selectAuthMethod(rl, question);
      const config: Partial<IAuthOptions & { siteUrl: string }> = { siteUrl };

      // Ask for all required fields
      for (const field of authMethod.requiredFields) {
        const promptText = field.optional ? `${field.prompt} (optional)` : field.prompt;
        const value = await question(`${promptText}: `);

        if (value || !field.optional) {
          if (field.secret && this.settings.encryptPassword && value) {
            config[field.key] = this.cpass.encode(value);
          } else if (value) {
            config[field.key] = value;
          }
        }
      }

      // Set any special flags for this auth method
      if (authMethod.setFlags) {
        authMethod.setFlags(config);
      }

      // Save config
      if (this.settings.saveConfigOnDisk) {
        await this.saveConfig(config);
        console.log(`\n✓ Configuration saved to ${this.settings.configPath}\n`);
      }

      return config;
    } finally {
      rl.close();
    }
  }

  private updateConfig = async (existingConfig: any): Promise<any> => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string, defaultValue?: string): Promise<string> => {
      const promptText = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
      return new Promise((resolve) => {
        rl.question(promptText, (answer) => {
          const trimmed = answer.trim();
          resolve(trimmed || defaultValue || '');
        });
      });
    };

    try {
      const config = { ...existingConfig };

      // Ensure site URL
      if (!config.siteUrl) {
        config.siteUrl = await question('SharePoint site URL');
      }

      // Detect auth method and get missing required fields
      const authMethodId = detectAuthMethod(config);
      let authMethod = authMethodId ? getAuthMethod(authMethodId) : null;

      // If no auth method specified, prompt user to select one
      if (!authMethod) {
        authMethod = await this.selectAuthMethod(rl, question);
        // Set the authMethod flag
        if (authMethod.setFlags) {
          authMethod.setFlags(config);
        }
      }

      console.log(`\nUpdating ${authMethod.name} configuration...\n`);

      for (const field of authMethod.requiredFields) {
        if (!field.optional && !config[field.key]) {
          const value = await question(field.prompt);
          if (field.secret && this.settings.encryptPassword && value) {
            config[field.key] = this.cpass.encode(value);
          } else if (value) {
            config[field.key] = value;
          }
        }
      }

      // Save updated config
      if (this.settings.saveConfigOnDisk) {
        await this.saveConfig(config);
        console.log('\n✓ Configuration updated\n');
      }

      return config;
    } finally {
      rl.close();
    }
  }

  private saveConfig = async (config: any): Promise<void> => {
    const dir = path.dirname(this.settings.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.settings.configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  private getHiddenPropertyName = (data: { [key: string]: string; }): string => {
    if (data.password) {
      return 'password';
    }
    if (data.clientSecret) {
      return 'clientSecret';
    }
    return undefined;
  }
  private getJsonContent = (filePath: string, jsonData?: IAuthOptions): { exists: boolean; jsonRawData: any } => {
    if (typeof jsonData === 'undefined') {
      const exists = fs.existsSync(filePath);
      let jsonRawData: any = {};
      if (exists) {
        try {
          const rawContent = fs.readFileSync(path.resolve(filePath)).toString();
          jsonRawData = JSON.parse(rawContent);
          // jsonRawData = require(filePath);
        } catch (ex) { /**/ }
      }
      return { exists, jsonRawData };
    } else {
      return { exists: true, jsonRawData: jsonData };
    }
  }
}