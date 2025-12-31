import {
  bootstrap
} from 'global-agent';

export interface IConfiguration {
  requestOptions?: RequestInit;
}

if (process.env['http_proxy'] || process.env['https_proxy']) {
  if (process.env['http_proxy']) {
    process.env.GLOBAL_AGENT_HTTP_PROXY = process.env['http_proxy'];
  }
  if (process.env['https_proxy']) {
    process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env['https_proxy'];
  }

  bootstrap();
}

// Disable SSL certificate validation for self-signed certificates
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let customRequestOptions: RequestInit = {};

export const request = {
  post: async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
      ...customRequestOptions,
      ...options
    });

    // Always return JSON body, even for error responses
    // OAuth endpoints return error details in JSON format with status 400
    try {
      return await response.json();
    } catch (ex) {
      throw new Error(`Request failed with status ${response.status}: ${response.statusText}`);
    }
  }
};

export function setup(config: IConfiguration): void {
  if (config.requestOptions) {
    customRequestOptions = { ...customRequestOptions, ...config.requestOptions };
  }
}