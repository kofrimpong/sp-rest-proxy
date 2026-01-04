import { IOnlineAappOnlyCredentials, ITokenResponse } from '../IAuthOptions';
import { IAuthResponse } from '../IAuthResponse';
import { OnlineResolver } from './OnlineResolver';
import { Cache } from '../utils/Cache';
import { request } from '../config';
import { HostingEnvironment } from '../HostingEnvironment';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';


//https://github.com/LucasMarangon/Azure_Oauth_JWT/tree/main
export class OnlineAppOnlyCredentials extends OnlineResolver {

  private static TokenCache: Cache = new Cache();

  constructor(_siteUrl: string, private _authOptions: IOnlineAappOnlyCredentials) {
    super(_siteUrl);
  }

  public getAuth(): Promise<IAuthResponse> {
    const sharepointhostname: string = new URL(this._siteUrl).hostname;
    const cacheKey = `${sharepointhostname}@${this._authOptions.pfxCertificatePath}@${this._authOptions.clientId}`;
    const cachedToken: string = OnlineAppOnlyCredentials.TokenCache.get<string>(cacheKey);

    if (cachedToken) {
      return Promise.resolve({
        headers: {
          'Authorization': `Bearer ${cachedToken}`
        }
      });
    }
    return this.getAppOnlyAccessToken(this._authOptions.clientId, this._authOptions.pfxCertificatePath, this._authOptions.certificatePassword, this._authOptions.tenantId)
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

  private getAppOnlyAccessToken(clientId: string, certificatePath: string, certificatePassword: string | undefined, tenantId: string): Promise<ITokenResponse> {
    return this.getAppOnlyAccessTokenWithCertificate(clientId, certificatePath, certificatePassword, tenantId);
  }

  private getAppOnlyAccessTokenWithCertificate(clientId: string, certificatePath: string, certificatePassword: string | undefined, tenantId: string): Promise<ITokenResponse> {
    // Use Azure AD app-only authentication with certificate (Microsoft identity platform)
    // This follows the JWT bearer token flow required by SharePoint Online
    const authEndpoint = this.getAuthEndpoint();
    const tokenUrl = `https://${authEndpoint}/${tenantId}/oauth2/v2.0/token`;
    const sharePointHostname = new URL(this._siteUrl).hostname;

    try {
      // Load certificate from PFX file
      const pfxBuffer = fs.readFileSync(certificatePath);

      // Extract private key for signing
      // Note: PFX/PKCS#12 format - pass buffer directly with passphrase if provided
      const privateKey = certificatePassword
        ? crypto.createPrivateKey({
          key: pfxBuffer,
          format: 'pem' as any, // Type workaround for PFX
          passphrase: certificatePassword
        })
        : crypto.createPrivateKey(pfxBuffer);

      // Create JWT using jsonwebtoken library
      const jwtToken = this.createClientAssertion(clientId, tenantId, privateKey, this._authOptions.shaThumbprint);

      // Exchange JWT for access token
      const params: URLSearchParams = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', clientId);
      params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      params.append('client_assertion', jwtToken);
      params.append('scope', this.buildScopes([], false));

      return request.post(tokenUrl, {
        body: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }).then((response: { access_token?: string; expires_in?: number }) => {
        if (response && response.access_token) {
          return {
            access_token: response.access_token,
            expires_in: response.expires_in || 3599
          };
        } else {
          return Promise.reject('No access token in response');
        }
      });
    } catch (error) {
      return Promise.reject(`Error loading certificate or creating JWT: ${error}`);
    }
  }


  private createClientAssertion(clientId: string, tenantId: string, privateKey: crypto.KeyObject, certThumbprint: string): string {
    const now = Math.floor(Date.now() / 1000);
    const authEndpoint = this.getAuthEndpoint();
    const audience = `https://${authEndpoint}/${tenantId}/v2.0`;

    // JWT header with certificate thumbprint
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      x5t: certThumbprint
    };

    // JWT payload
    const payload = {
      aud: audience,
      exp: now + 3600, // 1 hour expiry
      iss: clientId,
      sub: clientId,
      jti: crypto.randomUUID(),
      nbf: now - 300 // Not before: 5 minutes ago for clock skew
    };

    // Sign JWT using jsonwebtoken library
    const token = jwt.sign(payload, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
      header,
      algorithm: 'RS256'
    });

    return token;
  }

  protected InitEndpointsMappings(): void {
    this.endpointsMappings.set(HostingEnvironment.Production, 'login.microsoftonline.com');
    this.endpointsMappings.set(HostingEnvironment.China, 'login.chinacloudapi.cn');
    this.endpointsMappings.set(HostingEnvironment.German, 'login.microsoftonline.de');
    this.endpointsMappings.set(HostingEnvironment.USDefence, 'login.microsoftonline.us');
    this.endpointsMappings.set(HostingEnvironment.USGovernment, 'login.microsoftonline.us');
  }

}
