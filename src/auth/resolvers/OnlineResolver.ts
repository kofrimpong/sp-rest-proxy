import { HostingEnvironment } from '../HostingEnvironment';
import { IAuthResolver } from './IAuthResolver';
import { IAuthResponse } from '../IAuthResponse';
import { UrlHelper } from '../utils/UrlHelper';

export abstract class OnlineResolver implements IAuthResolver {

  protected hostingEnvironment: HostingEnvironment;
  protected endpointsMappings: Map<HostingEnvironment, string>;

  constructor(protected _siteUrl: string) {
    this.endpointsMappings = new Map();
    this.hostingEnvironment = UrlHelper.ResolveHostingEnvironment(this._siteUrl);
    this.InitEndpointsMappings();
  }

  public abstract getAuth(): Promise<IAuthResponse>;
  protected abstract InitEndpointsMappings(): void;

  protected getAuthEndpoint(): string {
    return this.endpointsMappings.get(this.hostingEnvironment) || 'login.microsoftonline.com';
  }

  /**
   * Build the scopes string for OAuth requests.
   * Combines default SharePoint scopes with any custom scopes provided by the user.
   * @param customScopes - Optional custom scopes to include
   * @param includeOfflineAccess - Whether to include offline_access scope (default: true)
   * @returns Space-separated scopes string
   */
  protected buildScopes(customScopes?: string | string[], includeOfflineAccess = true): string {
    const sharePointHostname = new URL(this._siteUrl).hostname;
    const tenantDomain = sharePointHostname.split('.sharepoint.com')[0] + '.sharepoint.com';

    // Default SharePoint scope
    const defaultScopes = [`https://${tenantDomain}/.default`];

    if (includeOfflineAccess) {
      defaultScopes.push('offline_access');
    }

    // If custom scopes provided, merge with defaults
    if (customScopes) {
      const customScopesArray = Array.isArray(customScopes) ? customScopes : [customScopes];
      // Combine and deduplicate
      const allScopes = Array.from(new Set([...defaultScopes, ...customScopesArray]));
      return allScopes.join(' ');
    }

    return defaultScopes.join(' ');
  }
}