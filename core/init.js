import { appState, getDomainConfigStorage } from './config.js';

export async function init() {
    const hostname = window.location.hostname;
    appState.domainConfigStorage = getDomainConfigStorage(hostname);
    appState.domainConfig = await appState.domainConfigStorage.getValue();
}
