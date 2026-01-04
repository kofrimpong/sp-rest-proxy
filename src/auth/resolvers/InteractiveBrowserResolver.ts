import { IAuthResponse } from '../IAuthResponse';
import { OnlineResolver } from './OnlineResolver';
import { Cache } from '../utils/Cache';
import { request } from '../config';
import { HostingEnvironment } from '../HostingEnvironment';
import { createHash, randomBytes } from 'crypto';
import * as http from 'http';
import { exec } from 'child_process';
import { IInteractiveBrowserCredentials, ITokenResponse } from '../IAuthOptions';

export class InteractiveBrowserResolver extends OnlineResolver {

  private static TokenCache: Cache = new Cache();
  private readonly port: string;

  constructor(_siteUrl: string, private _authOptions: IInteractiveBrowserCredentials) {
    super(_siteUrl);
    const portVal = typeof _authOptions.redirectPort !== 'undefined' ? String(_authOptions.redirectPort) : '5000';
    this.port = portVal || '5000';
  }

  public getAuth(): Promise<IAuthResponse> {
    const sharepointhostname: string = new URL(this._siteUrl).hostname;
    const tenantDomain = sharepointhostname.split('.sharepoint.com')[0] + '.sharepoint.com';
    const cacheKey = `${tenantDomain}@${this._authOptions.clientId}:interactive`;

    const cachedToken: string = InteractiveBrowserResolver.TokenCache.get<string>(cacheKey);

    if (cachedToken) {
      return Promise.resolve({
        headers: {
          'Authorization': `Bearer ${cachedToken}`
        }
      });
    }

    // Try to get token using refresh token if available
    const cachedRefreshToken: string = InteractiveBrowserResolver.TokenCache.get<string>(`${cacheKey}:refresh`);

    if (cachedRefreshToken) {
      return this.refreshAccessToken(cachedRefreshToken, cacheKey);
    }

    // No cached token, initiate interactive browser flow
    return this.initiateInteractiveBrowserFlow(cacheKey);
  }

  private initiateInteractiveBrowserFlow(cacheKey: string): Promise<IAuthResponse> {
    return new Promise((resolve, reject) => {
      // Generate PKCE challenge
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = randomBytes(16).toString('hex');

      const scope = this.buildScopes();

      const builtRedirectUri = `http://localhost:${this.port}`;
      const authEndpoint = this.getAuthEndpoint();
      const authUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(this._authOptions.clientId)}&` +
        'response_type=code&' +
        `redirect_uri=${encodeURIComponent(builtRedirectUri)}&` +
        'response_mode=query&' +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        'code_challenge_method=S256';

      console.log('\n=== INTERACTIVE AUTHENTICATION ===');
      console.log('Opening browser for authentication...');
      console.log('===================================\n');

      // Start local server to receive callback
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${this.port}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Failed</h1><p>You can close this window.</p></body></html>');
          server.close();
          reject(new Error(`Authentication failed: ${error}`));
          return;
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid Response</h1><p>You can close this window.</p></body></html>');
          server.close();
          reject(new Error('Invalid authentication response'));
          return;
        }

        try {
          // Exchange code for token
          const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

          // Cache tokens
          const expirationSeconds = Math.max(tokenResponse.expires_in - 300, 60);
          InteractiveBrowserResolver.TokenCache.set<string>(cacheKey, tokenResponse.access_token, expirationSeconds);

          if (tokenResponse.refresh_token) {
            InteractiveBrowserResolver.TokenCache.set<string>(`${cacheKey}:refresh`, tokenResponse.refresh_token, 90 * 24 * 60 * 60);
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Successful!</h1><p>You can close this window and return to your application.</p></body></html>');

          console.log('\n✓ Authentication successful!\n');

          server.close();
          resolve({
            headers: {
              'Authorization': `Bearer ${tokenResponse.access_token}`
            }
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authentication Error</h1><p>You can close this window.</p></body></html>');
          server.close();
          reject(err);
        }
      });

      server.listen(parseInt(this.port, 10), () => {
        this.openBrowser(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000);
    });
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<ITokenResponse> {
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', this._authOptions.clientId);
    params.append('code', code);
    const builtRedirectUri = `http://localhost:${this.port}`;
    params.append('redirect_uri', builtRedirectUri);
    params.append('code_verifier', codeVerifier);
    params.append('scope', this.buildScopes());

    // Add client_secret if available (for confidential clients)
    if (this._authOptions.clientSecret) {
      params.append('client_secret', this._authOptions.clientSecret);
    }

    const response = await request.post(tokenUrl, {
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.error) {
      throw new Error(`Token exchange failed: ${response.error_description || response.error}`);
    }

    return response as ITokenResponse;
  }

  private refreshAccessToken(refreshToken: string, cacheKey: string): Promise<IAuthResponse> {
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${this._authOptions.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', this._authOptions.clientId);
    params.append('refresh_token', refreshToken);
    params.append('scope', this.buildScopes());

    // Add client_secret if available (for confidential clients)
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
        InteractiveBrowserResolver.TokenCache.remove(`${cacheKey}:refresh`);
        return this.initiateInteractiveBrowserFlow(cacheKey);
      }

      const tokenResponse = response as ITokenResponse;
      const expirationSeconds = Math.max(tokenResponse.expires_in - 300, 60);

      InteractiveBrowserResolver.TokenCache.set<string>(cacheKey, tokenResponse.access_token, expirationSeconds);

      if (tokenResponse.refresh_token) {
        InteractiveBrowserResolver.TokenCache.set<string>(`${cacheKey}:refresh`, tokenResponse.refresh_token, 90 * 24 * 60 * 60);
      }

      return {
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`
        }
      };
    }).catch(() => {
      InteractiveBrowserResolver.TokenCache.remove(`${cacheKey}:refresh`);
      return this.initiateInteractiveBrowserFlow(cacheKey);
    });
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private openBrowser(url: string): void {
    const platform = process.platform;
    let command: string;

    if (platform === 'win32') {
      // Windows: Use "" to properly quote the URL
      command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error) => {
      if (error) {
        console.error('Could not open browser automatically. Please navigate to:');
        console.log(url);
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
