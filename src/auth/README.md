# Authentication Resolver Registry

## Overview

The authentication system uses a **registry pattern** with a **plugin system** that allows you to add custom authentication methods without modifying any core files.

## Quick Start: Adding a Custom Authentication Method

You only need to create your resolver class and register it - no core file modifications required!

```typescript
import {
  registerAuthMethod,
  registerAuthResolver,
  IAuthResolver,
  IAuthResponse,
  ICustomAuthCredentials
} from 'sp-rest-proxy/dist/auth';

// 1. Define your options interface (extends ICustomAuthCredentials for type safety)
interface IMyCertOptions extends ICustomAuthCredentials {
  clientId: string;
  certificatePath: string;
  certificatePassword?: string;
  authMethod: 'myCert';
}

// 2. Create your resolver class
class MyCertificateResolver implements IAuthResolver {
  constructor(
    private siteUrl: string,
    private authOptions: IMyCertOptions
  ) {}

  public async getAuth(): Promise<IAuthResponse> {
    // Your authentication logic
    const token = await this.acquireToken();
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  private async acquireToken(): Promise<string> {
    // Implementation
  }
}

// 3. Register the resolver factory
registerAuthResolver((siteUrl, options) => {
  if (options.authMethod === 'myCert') {
    return new MyCertificateResolver(siteUrl, options as IMyCertOptions);
  }
  return null; // Not handled by this resolver
});

// 4. Register the auth method (for the config wizard)
registerAuthMethod({
  id: 'myCert',
  name: 'Certificate-Based',
  description: 'using X.509 certificate',
  requiredFields: [
    { key: 'clientId', prompt: 'Client ID' },
    { key: 'certificatePath', prompt: 'Certificate Path' },
    { key: 'certificatePassword', prompt: 'Certificate Password', secret: true, optional: true }
  ],
  setFlags: (config) => {
    config.authMethod = 'myCert';
  }
});
```

That's it! Your custom authentication method is now fully integrated.

## Detailed Guide

### Method 1: Plugin System (Recommended)

This approach requires **no modifications to core files**.

#### Step 1: Create Your Resolver Class

```typescript
import {
  IAuthResolver,
  IAuthResponse,
  ICustomAuthCredentials
} from 'sp-rest-proxy/dist/auth';

// Define your options interface - extend ICustomAuthCredentials for type safety
interface IMyCertOptions extends ICustomAuthCredentials {
  clientId: string;
  certificatePath: string;
  certificatePassword?: string;
  authMethod: 'myCert';
}

export class MyCertificateResolver implements IAuthResolver {
  constructor(
    private siteUrl: string,
    private authOptions: IMyCertOptions
  ) {}

  public async getAuth(): Promise<IAuthResponse> {
    // Your authentication logic here
    const token = await this.acquireToken();

    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  private async acquireToken(): Promise<string> {
    // Implementation
  }
}
```

#### Step 2: Register Your Resolver

In your application startup code (e.g., before starting the proxy):

```typescript
import { registerAuthResolver } from 'sp-rest-proxy/dist/auth';
import { MyCertificateResolver, IMyCertOptions } from './MyCertificateResolver';

registerAuthResolver((siteUrl, options) => {
  if (options.authMethod === 'myCert') {
    return new MyCertificateResolver(siteUrl, options as IMyCertOptions);
  }
  return null;
});
```

#### Step 3: Register the Auth Method (Optional)

This step is only needed if you want your method to appear in the configuration wizard:

```typescript
import { registerAuthMethod } from 'sp-rest-proxy/dist/auth';

registerAuthMethod({
  id: 'myCert',
  name: 'Certificate-Based Authentication',
  description: 'using X.509 certificate',
  requiredFields: [
    { key: 'clientId', prompt: 'Client ID' },
    { key: 'certificatePath', prompt: 'Path to certificate file' },
    { key: 'certificatePassword', prompt: 'Certificate password (optional)', secret: true, optional: true }
  ],
  setFlags: (config) => {
    config.authMethod = 'myCert';
  }
});
```

**server.ts:**
```typescript
import './register-custom-auth'; // Register before starting proxy
import { RestProxy } from 'sp-rest-proxy';

const settings = {
  configPath: './config/private.json',
  port: 8080
};

const restProxy = new RestProxy(settings);
restProxy.serve();
```

## That's It!

### Using the Plugin System

The configuration wizard will automatically:
- Display your new method in the menu (if registered with `registerAuthMethod`)
- Ask for all required fields
- Apply encryption to secret fields
- Set any custom flags via `setFlags`
- Validate the configuration


## API Reference

### `registerAuthResolver(factory: IResolverFactory): void`

Register a custom authentication resolver factory.

**Parameters:**
- `factory`: A function `(siteUrl: string, options: IAuthOptions) => IAuthResolver | null`
  - Should return a resolver instance if it can handle the options
  - Should return `null` if it cannot handle the options

**Example:**
```typescript
registerAuthResolver((siteUrl, options) => {
  if (options.authMethod === 'myCustom') {
    return new MyCustomResolver(siteUrl, options);
  }
  return null;
});
```

### `registerAuthMethod(method: IAuthMethodConfig): void`

Register a custom authentication method for the configuration wizard.

**Parameters:**
- `method`: An object with:
  - `id`: Unique identifier for the method
  - `name`: Display name
  - `description`: Short description
  - `requiredFields`: Array of field configurations
  - `setFlags`: Optional function to set config flags

**Example:**
```typescript
registerAuthMethod({
  id: 'saml',
  name: 'SAML Authentication',
  description: 'using SAML 2.0',
  requiredFields: [
    { key: 'idpUrl', prompt: 'Identity Provider URL' },
    { key: 'entityId', prompt: 'Service Provider Entity ID' }
  ],
  setFlags: (config) => {
    config.authMethod = 'saml';
  }
});
```

## Field Configuration Options

```typescript
interface IFieldConfig {
  key: string;       // Property name in config object
  prompt: string;    // Text shown to user
  secret?: boolean;  // If true, will be encrypted with cpass
  optional?: boolean; // If true, user can skip this field
}
```

The plugin system provides the same functionality with better maintainability!
