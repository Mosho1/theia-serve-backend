
/**
 * Generated using theia-plugin-generator
 */

import * as theia from '@theia/plugin';
import { StaticServer } from './server';

const server = new StaticServer({ port: 4000 });

export function start(context: theia.PluginContext) {
    const runServerCommand = {
        id: 'theia-serve-run-server',
        label: "Serve workspace"
    };
    const startServer = async (path: string) => {
        try {
            if (!theia.workspace.workspaceFolders || theia.workspace.workspaceFolders.length === 0) {
                throw new Error('No active workspace!');
            }
            const path = theia.workspace.workspaceFolders[0].uri.path;
            await server.start(path);
            const message = `Started workspace server serving ${path} on port ${server.options.port}`;
            theia.window.showInformationMessage(message);
            console.log(message);
        } catch (e) {
            theia.window.showErrorMessage(e.message)
            console.error(e);
        }

    };
    theia.commands.registerCommand(runServerCommand, (...args: any[]) => {
        startServer('/');
    });
}

export function stop() {
    return server.stop();
}
