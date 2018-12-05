
/**
 * Generated using theia-plugin-generator
 */

import * as theia from '@theia/plugin';
import { StaticServer } from './server';

const server = new StaticServer({ port: 4000 });
const runServerCommand = {
    id: 'theia-serve-run-server',
    label: "Serve workspace"
};
const info = (message: string) => {
    theia.window.showInformationMessage(message);
    console.log(message);
};
const error = (e: Error) => {
    theia.window.showErrorMessage(e.message)
    console.error(e);
};
const runServer = async () => {
    try {
        if (!theia.workspace.workspaceFolders || theia.workspace.workspaceFolders.length === 0) {
            throw new Error('No active workspace!');
        }
        const path = theia.workspace.workspaceFolders[0].uri.path;
        await server.start(path);
        const message = `Started workspace server serving ${path} on port ${server.options.port}`;
        info(message);
    } catch (e) {
        error(e);
    }
};
export function start(context: theia.PluginContext) {
    theia.commands.registerCommand(runServerCommand, runServer);
}

export function stop() {
    return server.stop();
}
