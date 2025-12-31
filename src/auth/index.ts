import { IAuthResponse } from './IAuthResponse';
import { IAuthOptions } from './IAuthOptions';
import { AuthResolverFactory } from './resolvers/AuthResolverFactory';

export function getAuth(url: string, options?: IAuthOptions): Promise<IAuthResponse> {
  return AuthResolverFactory.resolve(url, options).getAuth();
}

export * from './IAuthOptions';
export * from './IAuthResponse';
export { setup, IConfiguration } from './config';
export * from './authResolverRegistry';