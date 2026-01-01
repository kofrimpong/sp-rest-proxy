import { IAuthResponse } from '../IAuthResponse';
import { OnlineResolver } from './OnlineResolver';
import { Cache } from '../utils/Cache';
import { request } from '../config';
import { HostingEnvironment } from '../HostingEnvironment';
import { exec } from 'child_process';

interface IDeviceCodeOptions {
  clientId: string;
  tenantId: string;
  clientSecret?: string; // Optional: for confidential clients
}

interface IDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

interface ITokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class DeviceCodeResolver extends OnlineResolver {

  private static TokenCache: Cache = new Cache();

  constructor(_siteUrl: string, private _authOptions: IDeviceCodeOptions) {
    super(_siteUrl);
  }

  public getAuth(): Promise<IAuthResponse> {
    const sharepointhostname: string = new URL(this._siteUrl).hostname;
    const cacheKey = `${sharepointhostname}@${this._authOptions.clientId}`;

    const cachedToken: string = DeviceCodeResolver.TokenCache.get<string>(cacheKey);

    if (cachedToken) {
      return Promise.resolve({
        headers: {
          'Authorization': `Bearer ${cachedToken}`
        }
      });
    }

    // Try to get token using refresh token if available
    const cachedRefreshToken: string = DeviceCodeResolver.TokenCache.get<string>(`${cacheKey}:refresh`);

    if (cachedRefreshToken) {
      return this.refreshAccessToken(cachedRefreshToken, cacheKey);
    }

    // No cached token, initiate device code flow
    return this.initiateDeviceCodeFlow(cacheKey);
  }

  private initiateDeviceCodeFlow(cacheKey: string): Promise<IAuthResponse> {
    const sharePointHostname = new URL(this._siteUrl).hostname;
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/devicecode`;

    const params = new URLSearchParams();
    params.append('client_id', this._authOptions.clientId);
    params.append('scope', `https://${sharePointHostname}/.default offline_access`);

    return request.post(tokenUrl, {
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then((response: IDeviceCodeResponse) => {
      console.log('\n=== DEVICE CODE AUTHENTICATION ===');
      console.log(response.message);
      console.log('\nOpening browser...');
      console.log('If browser doesn\'t open, go to:', response.verification_uri);
      console.log('Enter code:', response.user_code);
      console.log('===================================\n');

      // Automatically open browser
      this.openBrowser(response.verification_uri);

      return this.pollForToken(response, cacheKey);
    });
  }

  private pollForToken(deviceCodeResponse: IDeviceCodeResponse, cacheKey: string): Promise<IAuthResponse> {
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/token`;
    const interval = (deviceCodeResponse.interval || 5) * 1000;
    const expiresAt = Date.now() + (deviceCodeResponse.expires_in * 1000);

    return new Promise((resolve, reject) => {
      const poll = () => {
        if (Date.now() > expiresAt) {
          reject(new Error('Device code expired. Please try again.'));
          return;
        }

        const params = new URLSearchParams();
        params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
        params.append('client_id', this._authOptions.clientId);
        params.append('device_code', deviceCodeResponse.device_code);

        if (this._authOptions.clientSecret) {
          params.append('client_secret', this._authOptions.clientSecret);
        }

        request.post(tokenUrl, {
          body: params.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).then((response: any) => {
          if (response.error) {
            if (response.error === 'authorization_pending') {
              // User hasn't completed auth yet, continue polling
              setTimeout(poll, interval);
            } else if (response.error === 'slow_down') {
              // Increase polling interval
              setTimeout(poll, interval + 5000);
            } else {
              reject(new Error(`Authentication failed: ${response.error_description || response.error}`));
            }
          } else {
            // Success! Cache the tokens
            const tokenResponse = response as ITokenResponse;
            const expirationSeconds = Math.max(tokenResponse.expires_in - 300, 60);

            DeviceCodeResolver.TokenCache.set<string>(cacheKey, tokenResponse.access_token, expirationSeconds);

            if (tokenResponse.refresh_token) {
              // Cache refresh token for 90 days
              DeviceCodeResolver.TokenCache.set<string>(`${cacheKey}:refresh`, tokenResponse.refresh_token, 90 * 24 * 60 * 60);
            }

            console.log('\n✓ Authentication successful!\n');

            resolve({
              headers: {
                'Authorization': `Bearer ${tokenResponse.access_token}`
              }
            });
          }
        }).catch(reject);
      };

      poll();
    });
  }

  private refreshAccessToken(refreshToken: string, cacheKey: string): Promise<IAuthResponse> {
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/token`;
    const sharePointHostname = new URL(this._siteUrl).hostname;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this._authOptions.clientId);
    params.append('refresh_token', refreshToken);
    params.append('scope', `https://${sharePointHostname}/.default offline_access`);

    if (this._authOptions.clientSecret) {
      params.append('client_secret', this._authOptions.clientSecret);
    }

    return request.post(tokenUrl, {
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).then((response: any) => {
      if (response.error) {
        // Refresh token failed, clear cache and re-initiate device code flow
        DeviceCodeResolver.TokenCache.remove(`${cacheKey}:refresh`);
        return this.initiateDeviceCodeFlow(cacheKey);
      }

      const tokenResponse = response as ITokenResponse;
      const expirationSeconds = Math.max(tokenResponse.expires_in - 300, 60);

      DeviceCodeResolver.TokenCache.set<string>(cacheKey, tokenResponse.access_token, expirationSeconds);

      if (tokenResponse.refresh_token) {
        DeviceCodeResolver.TokenCache.set<string>(`${cacheKey}:refresh`, tokenResponse.refresh_token, 90 * 24 * 60 * 60);
      }

      return {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`
        }
      };
    }).catch(() => {
      // On any error, fall back to device code flow
      DeviceCodeResolver.TokenCache.remove(`${cacheKey}:refresh`);
      return this.initiateDeviceCodeFlow(cacheKey);
    });
  }

  private openBrowser(url: string): void {
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      command = `start ${url}`;
    } else if (platform === 'darwin') {
      command = `open ${url}`;
    } else {
      command = `xdg-open ${url}`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Could not open browser automatically:', error.message);
      }
    })
  }

  protected InitEndpointsMappings(): void {
    this.endpointsMappings.set(HostingEnvironment.Production, 'login.microsoftonline.com');
    this.endpointsMappings.set(HostingEnvironment.China, 'login.chinacloudapi.cn');
    this.endpointsMappings.set(HostingEnvironment.German, 'login.microsoftonline.de');
    this.endpointsMappings.set(HostingEnvironment.USDefence, 'login.microsoftonline.us');
    this.endpointsMappings.set(HostingEnvironment.USGovernment, 'login.microsoftonline.us');
  }

}
