import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';

import { UrlHelper } from './UrlHelper';
import { IAuthConfigSettings, IAuthContext, IAuthContextSettings } from '../IAuthOptions';
import { Cpass } from 'cpass';

export class FilesHelper {

  public static getUserDataFolder(): string {
    const platform = process.platform;
    let homepath: string;

    if (platform.lastIndexOf('win') === 0) {
      homepath = process.env.APPDATA || process.env.LOCALAPPDATA;
    }

    if (platform === 'darwin') {
      homepath = process.env.HOME;
      homepath = path.join(homepath, 'Library', 'Preferences');
    }

    if (platform === 'linux') {
      homepath = process.env.HOME;
    }

    if (!homepath) {
      throw new Error('Couldn\'t find the base application data folder');
    }

    const dataPath = path.join(homepath, 'spauth');
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath);
    }

    return dataPath;
  }

  public static resolveFileName(siteUrl: string): string {
    const url = FilesHelper.resolveSiteUrl(siteUrl);
    return url.replace(/[:/\s]/g, '_');
  }

  private static resolveSiteUrl(siteUrl: string): string {
    if (siteUrl.indexOf('/_') === -1 && siteUrl.indexOf('/vti_') === -1) {
      return UrlHelper.removeTrailingSlash(siteUrl);
    }

    if (siteUrl.indexOf('/_') !== -1) {
      return siteUrl.slice(0, siteUrl.indexOf('/_'));
    }

    if (siteUrl.indexOf('/vti_') !== -1) {
      return siteUrl.slice(0, siteUrl.indexOf('/vti_'));
    }

    throw new Error('Unable to resolve web site url from full request url');
  }

  private static convertAuthContextToSettings(authContext: IAuthContext, settings: IAuthConfigSettings = {}): IAuthContextSettings {
    const passwordPropertyName = FilesHelper.getHiddenPropertyName(authContext.authOptions as any);
    const password = (authContext.authOptions as any)[passwordPropertyName];
    let plainContext: IAuthContextSettings = {
      siteUrl: authContext.siteUrl,
      ...authContext.authOptions,
      custom: authContext.custom
    };
    if (typeof password !== 'undefined' && settings.encryptPassword) {
      const cpass = new Cpass(settings.masterKey);
      const decodedPassword = cpass.decode(password);
      const encodedPassword = cpass.encode(decodedPassword);
      plainContext = {
        ...plainContext,
        [passwordPropertyName]: encodedPassword
      };
    }
    return plainContext;
  }

  public static saveConfigOnDisk(authContext: IAuthContext, settings: IAuthConfigSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      const configDataJson = FilesHelper.convertAuthContextToSettings(authContext, settings);
      const saveFolderPath = path.dirname(settings.configPath);
      mkdirp(saveFolderPath).then(() => {
        const data = JSON.stringify(configDataJson, null, 2);
        fs.writeFile(settings.configPath, data, 'utf8', (err) => {
          if (err) {
            console.error(err);
            return reject(err);
          }
          resolve();
        });
      }).catch((ex) => {
        console.error(`Error creating folder "${saveFolderPath}"`, ex);
      });
    });
  }

  private static getHiddenPropertyName = (data: { [key: string]: string; }): string => {
    if (data.password) {
      return 'password';
    }
    if (data.clientSecret) {
      return 'clientSecret';
    }
    return undefined;
  }
}