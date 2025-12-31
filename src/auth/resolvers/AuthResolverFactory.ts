import * as authOptions from '../IAuthOptions';
import { IAuthResolver } from './IAuthResolver';
import { FileConfig } from './FileConfig';
import { OnlineAppOnlyCredentials } from './OnlineAppOnlyCredentials';
import { DeviceCodeResolver } from './DeviceCodeResolver';
import { InteractiveBrowserResolver } from './InteractiveBrowserResolver';

export class AuthResolverFactory {
  public static resolve(siteUrl: string, options?: authOptions.IAuthOptions): IAuthResolver {

    if (!options) {
      return new FileConfig(siteUrl);
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