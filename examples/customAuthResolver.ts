/**
 * Example: Adding a Custom Authentication Resolver
 *
 * This example demonstrates how to add a custom authentication method
 * without modifying any core library files.
 */

import {
  registerAuthMethod,
  registerAuthResolver,
  IAuthResolver,
  IAuthResponse,
  ICustomAuthCredentials
} from '../src/auth';

// 1. Define your custom options interface
// Extend ICustomAuthCredentials to ensure type compatibility
interface ICustomAuthOptions extends ICustomAuthCredentials {
  apiKey: string;
  apiSecret: string;
  authMethod: 'customApi';
}

// 2. Create your custom resolver class
class CustomApiAuthResolver implements IAuthResolver {
  constructor(
    private siteUrl: string,
    private authOptions: ICustomAuthOptions
  ) {}

  public async getAuth(): Promise<IAuthResponse> {
    // Your custom authentication logic
    const token = await this.acquireCustomToken();

    return {
      headers: {
        'Authorization': `Custom ${token}`,
        'X-API-Key': this.authOptions.apiKey
      }
    };
  }

  private async acquireCustomToken(): Promise<string> {
    // Implement your custom token acquisition logic
    // This could involve calling an external API, using certificates, etc.
    const { apiKey, apiSecret } = this.authOptions;

    // Example: Basic concatenation (replace with real logic)
    return Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  }
}

// 3. Register the resolver factory
// This function is called by the library to try to create your resolver
registerAuthResolver((siteUrl, options) => {
  // Check if these are the options your resolver handles
  if (options.authMethod === 'customApi') {
    return new CustomApiAuthResolver(siteUrl, options as ICustomAuthOptions);
  }
  // Return null if this resolver doesn't handle these options
  return null;
});

// 4. Register the auth method for the configuration wizard (optional)
// This makes your method available in the interactive configuration
registerAuthMethod({
  id: 'customApi',
  name: 'Custom API Authentication',
  description: 'using custom API key and secret',
  requiredFields: [
    { key: 'apiKey', prompt: 'API Key' },
    { key: 'apiSecret', prompt: 'API Secret', secret: true }
  ],
  setFlags: (config) => {
    config.authMethod = 'customApi';
  }
});

// 5. Use in your application
// In your server.ts or main file:
// import './customAuthResolver'; // This registers everything
//
// const restProxy = new RestProxy({
//   configPath: './config/private.json',
//   port: 8080
// });
//
// restProxy.serve();

console.log('Custom authentication resolver registered successfully!');
console.log('You can now use authMethod: "customApi" in your configuration.');
