import * as authOptions from '../IAuthOptions';
import { IAuthResolver } from './IAuthResolver';
import { FileConfig } from './FileConfig';
import { OnlineAppOnlyCredentials } from './OnlineAppOnlyCredentials';
import { DeviceCodeResolver } from './DeviceCodeResolver';
import { InteractiveBrowserResolver } from './InteractiveBrowserResolver';

/**
 * Type for custom resolver factory function
 */
export type IResolverFactory = (siteUrl: string, options: authOptions.IAuthOptions) => IAuthResolver | null;

/**
 * Registry of custom resolver factories
 */
const customResolvers: IResolverFactory[] = [];

/**
 * Register a custom authentication resolver factory
 * @param factory - A function that returns a resolver instance or null if it can't handle the options
 * @example
 * ```typescript
 * import { registerAuthResolver } from 'sp-rest-proxy/dist/auth/resolvers/AuthResolverFactory';
 * import { MyCertResolver } from './MyCertResolver';
 *
 * registerAuthResolver((siteUrl, options) => {
 *   if (options.authMethod === 'myCert') {
 *     return new MyCertResolver(siteUrl, options);
 *   }
 *   return null;
 * });
 * ```
 */
export function registerAuthResolver(factory: IResolverFactory): void {
  customResolvers.push(factory);
}

export class AuthResolverFactory {
  public static resolve(siteUrl: string, options?: authOptions.IAuthOptions): IAuthResolver {

    if (!options) {
      return new FileConfig(siteUrl);
    }

    // Try custom resolvers first
    for (const factory of customResolvers) {
      const resolver = factory(siteUrl, options);
      if (resolver) {
        return resolver;
      }
    }

    // Check device code first
    if (authOptions.isDeviceCode(options)) {
      return new DeviceCodeResolver(siteUrl, options);
    }

    // Check interactive browser flow
    if (authOptions.isInteractiveBrowser(options)) {
      return new InteractiveBrowserResolver(siteUrl, options);
    }

    // App-only flow
    if (authOptions.isAppOnlyOnline(options)) {
      return new OnlineAppOnlyCredentials(siteUrl, options);
    }

    throw new Error('Error while resolving authentication class');
  }
}