# Authentication Resolver Registry

## Overview

The authentication system uses a **registry pattern** to make it easy to add new authentication methods without modifying the configuration wizard code.

## Adding a New Authentication Method

To add a new authentication method, you only need to:

### 1. Create the Resolver Class

Create a new resolver in `src/auth/resolvers/YourNewResolver.ts`:

```typescript
import { IAuthResolver } from './IAuthResolver';
import { IAuthResponse } from '../IAuthResponse';

export class YourNewResolver implements IAuthResolver {
  constructor(
    private siteUrl: string,
    private authOptions: IYourNewCredentials
  ) {}

  public async getAuth(): Promise<IAuthResponse> {
    // Implementation
  }
}
```

### 2. Register in authResolverRegistry.ts

Add your authentication method to the `authMethods` array in `authResolverRegistry.ts`:

```typescript
{
  id: 'yourNew',
  name: 'Your New Method',
  description: 'short description',
  requiredFields: [
    { key: 'fieldName1', prompt: 'Field Name 1' },
    { key: 'fieldName2', prompt: 'Field Name 2', secret: true },
    { key: 'optionalField', prompt: 'Optional Field', optional: true }
  ],
  setFlags: (config) => {
    // Optional: Set any special flags in the config
    config.yourNewFlag = true;
  }
}
```

### 3. Add to AuthResolverFactory

Update `src/auth/resolvers/AuthResolverFactory.ts` to recognize your new method:

```typescript
import { YourNewResolver } from './YourNewResolver';
import { isYourNew } from '../IAuthOptions';

// In the resolve method:
if (isYourNew(options)) {
  return new YourNewResolver(url, options);
}
```

### 4. Add Type Definitions

Add interfaces and type guards to `src/auth/IAuthOptions.ts`:

```typescript
export interface IYourNewCredentials {
  fieldName1: string;
  fieldName2: string;
  optionalField?: string;
}

export function isYourNew(options: IAuthOptions): options is IYourNewCredentials {
  const opts = options as IYourNewCredentials;
  return !!opts.fieldName1 && !!opts.fieldName2;
}
```

## That's It!

The configuration wizard will automatically:
- Display your new method in the menu
- Ask for all required fields
- Apply encryption to secret fields
- Set any custom flags via `setFlags`
- Validate the configuration

No changes needed to `AuthConfig.ts`!

## Field Configuration Options

```typescript
interface IFieldConfig {
  key: string;       // Property name in config object
  prompt: string;    // Text shown to user
  secret?: boolean;  // If true, will be encrypted with cpass
  optional?: boolean; // If true, user can skip this field
}
```

## Example: Adding Certificate-Based Auth

```typescript
// In authResolverRegistry.ts
{
  id: 'certificate',
  name: 'Certificate-Based',
  description: 'using X.509 certificate',
  requiredFields: [
    { key: 'clientId', prompt: 'Client ID' },
    { key: 'tenantId', prompt: 'Tenant ID' },
    { key: 'certificatePath', prompt: 'Certificate Path' },
    { key: 'certificatePassword', prompt: 'Certificate Password', secret: true, optional: true }
  ],
  setFlags: (config) => {
    config.useCertificate = true;
  }
}
```

That's all you need! The system handles the rest automatically.
