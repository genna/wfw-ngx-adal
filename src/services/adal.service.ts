import { Injectable } from '@angular/core';
import { Observable ,  Subscriber } from 'rxjs';
import * as adalLib from 'adal-angular';
import { OAuthData } from './oauthdata.model';
import User = adal.User;

@Injectable()
export class AdalService {

	private adalContext: adal.AuthenticationContext;
	private oauthData: OAuthData = {
		isAuthenticated: false,
		userName: '',
		loginError: '',
		profile: {}
	};

	public init(configOptions: adal.Config) {
		if (!configOptions) {
			throw new Error('You must set config, when calling init.');
		}

		// redirect and logout_redirect are set to current location by default
		let existingHash = window.location.hash;
		let pathDefault = window.location.href;
		if (existingHash) {
			pathDefault = pathDefault.replace(existingHash, '');
		}

		configOptions.redirectUri = configOptions.redirectUri || pathDefault;
		configOptions.postLogoutRedirectUri = configOptions.postLogoutRedirectUri || pathDefault;

		// create instance with given config
		this.adalContext = adalLib.inject(configOptions);

		window.AuthenticationContext = this.adalContext.constructor;

		// loginresource is used to set authenticated status
		this.updateDataFromCache(this.adalContext.config.loginResource);
	}

	public get config(): adal.Config {
		return this.adalContext.config;
	}

	public get userInfo(): OAuthData {
		return this.oauthData;
	}

	public login(): void {
		this.adalContext.login();
	}

	public loginInProgress(): boolean {
		return this.adalContext.loginInProgress();
	}

	public logOut(): void {
		this.adalContext.logOut();
	}

	public handleWindowCallback(): void {
		let hash = window.location.hash;
		if (this.adalContext.isCallback(hash)) {
			let requestInfo = this.adalContext.getRequestInfo(hash);
			this.adalContext.saveTokenFromHash(requestInfo);
			if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.LOGIN) {
				this.updateDataFromCache(this.adalContext.config.loginResource);

			} else if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.RENEW_TOKEN) {
				this.adalContext.callback = window.parent.callBackMappedToRenewStates[requestInfo.stateResponse];
			}

			if (requestInfo.stateMatch) {
				if (typeof this.adalContext.callback === 'function') {
					if (requestInfo.requestType === this.adalContext.REQUEST_TYPE.RENEW_TOKEN) {
						// Idtoken or Accestoken can be renewed
						if (requestInfo.parameters['access_token']) {
							this.adalContext.callback(this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ERROR_DESCRIPTION)
								, requestInfo.parameters['access_token']);
						} else if (requestInfo.parameters['id_token']) {
							this.adalContext.callback(this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ERROR_DESCRIPTION)
								, requestInfo.parameters['id_token']);
						}
						else if (requestInfo.parameters['error']) {
							this.adalContext.callback(this.adalContext._getItem(this.adalContext.CONSTANTS.STORAGE.ERROR_DESCRIPTION), null);
							this.adalContext._renewFailed = true;
						}
					}
				}
			}
		}
	}

	public getCachedToken(resource: string): string {
		return this.adalContext.getCachedToken(resource);
	}

	public acquireToken(resource: string) {
		let _this = this;
		return Observable.create((subscriber: Subscriber<any>) => {
			let s: string = '';
			_this.adalContext.acquireToken(resource, (error: string, tokenOut: string) => {
				if (error) {
					_this.adalContext.error('Error when acquiring token for resource: ' + resource, error);
					subscriber.error(error);
				} else {
					subscriber.next(tokenOut);
					s = tokenOut;
				}
				subscriber.complete();
			});
			return s;
		});
	}

	public getUser(): Observable<adal.User> {
		return Observable.create((subscriber: Subscriber<any>) => {
			this.adalContext.getUser((error: string, user: adal.User) => {
				if (error) {
					this.adalContext.error('Error when getting user', error);
					subscriber.next(null);

				} else {
					subscriber.next(user);
				}
				subscriber.complete();
			});
		});
	}

	public clearCache(): void {
		this.adalContext.clearCache();
	}

	public clearCacheForResource(resource: string): void {
		this.adalContext.clearCacheForResource(resource);
	}

	public info(message: string): void {
		this.adalContext.info(message);
	}

	public verbose(message: string): void {
		this.adalContext.verbose(message);
	}

	public GetResourceForEndpoint(url: string): string {
		return this.adalContext.getResourceForEndpoint(url);
	}

	public refreshDataFromCache() {
		this.updateDataFromCache(this.adalContext.config.loginResource);
	}

	private updateDataFromCache(resource: string): void {
		let token = this.adalContext.getCachedToken(resource);
		this.oauthData.isAuthenticated = token !== null && token.length > 0;
		let user = this.adalContext.getCachedUser() || { userName: '', profile: undefined };
		this.oauthData.userName = user.userName;
		this.oauthData.profile = user.profile;
		this.oauthData.loginError = this.adalContext.getLoginError();

	};
}
