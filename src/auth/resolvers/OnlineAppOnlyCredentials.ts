import { IOnlineAappOnlyCredentials } from '../IAuthOptions';
import { IAuthResponse } from '../IAuthResponse';
import { OnlineResolver } from './OnlineResolver';
import { Cache } from '../utils/Cache';
import { request } from '../config';
import { HostingEnvironment } from '../HostingEnvironment';

interface ITokenResponse {
  access_token: string;
  expires_in: number;
}


export class OnlineAppOnlyCredentials extends OnlineResolver {

  private static TokenCache: Cache = new Cache();

  constructor(_siteUrl: string, private _authOptions: IOnlineAappOnlyCredentials) {
    super(_siteUrl);
  }

  public getAuth(): Promise<IAuthResponse> {
    const sharepointhostname: string = new URL(this._siteUrl).hostname;
    const cacheKey = `${sharepointhostname}@${this._authOptions.clientSecret}@${this._authOptions.clientId}`;
    const cachedToken: string = OnlineAppOnlyCredentials.TokenCache.get<string>(cacheKey);

    if (cachedToken) {
      return Promise.resolve({
        headers: {
          'Authorization': `Bearer ${cachedToken}`
        }
      });
    }
    return this.getAppOnlyAccessToken(this._authOptions.clientId, this._authOptions.clientSecret, this._authOptions.tenantId)
      .then((tokenResponse: ITokenResponse) => {
        // cache token using expires_in from response (subtract 5 minutes for safety)
        const expirationSeconds = Math.max(tokenResponse.expires_in - 300, 60);
        OnlineAppOnlyCredentials.TokenCache.set<string>(cacheKey, tokenResponse.access_token, expirationSeconds);
        return {
          headers: {
            'Authorization': `Bearer ${tokenResponse.access_token}`
          }
        };
      }).catch((err) => {
        console.error('Error obtaining app-only access token:', err);
        return Promise.reject(err);
      })
  }

  private getAppOnlyAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<ITokenResponse> {
    return this.getAppOnlyAccessTokenWithResource(clientId, clientSecret, tenantId);
  }

  private getAppOnlyAccessTokenWithResource(clientId: string, clientSecret: string, tenantId: string): Promise<ITokenResponse> {
    // Use Azure AD app-only authentication (Microsoft identity platform)
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const sharePointHostname = new URL(this._siteUrl).hostname;
    const params: URLSearchParams = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', `https://${sharePointHostname}/.default`);
    return request.post(tokenUrl, {
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then((response: any) => {
      if (response && response.access_token) {
        return {
          access_token: response.access_token,
          expires_in: response.expires_in || 3599 // default to ~1 hour if not provided
        };
      } else {
        return Promise.reject('No access token in response');
      }
    });
  }

  protected InitEndpointsMappings(): void {
    this.endpointsMappings.set(HostingEnvironment.Production, 'login.microsoftonline.com');
    this.endpointsMappings.set(HostingEnvironment.China, 'login.chinacloudapi.cn');
    this.endpointsMappings.set(HostingEnvironment.German, 'login.microsoftonline.de');
    this.endpointsMappings.set(HostingEnvironment.USDefence, 'login.microsoftonline.us');
    this.endpointsMappings.set(HostingEnvironment.USGovernment, 'login.microsoftonline.us');
  }

}

function err(reason: any): IAuthResponse | PromiseLike<IAuthResponse> {
  throw new Error('Function not implemented.');
}
