
/**
 * Generated using theia-plugin-generator
 */

import * as theia from '@theia/plugin';
import { StaticServer } from './server';

const server = new StaticServer({ port: 4000 });

export function start(context: theia.PluginContext) {
    theia.workspace.onDidChangeWorkspaceFolders(async (e) => {
        const { path } = e.added[0].uri;
        try {
            await server.start(path);
            const message = `Started workspace server serving ${path} on port ${server.options.port}`;
            console.log(message);
        } catch (e) {
            theia.window.showErrorMessage(e.message)
            console.error(e);
        }
    });
}

export function stop() {
    return server.stop();
}
