
/**
 * Generated using theia-plugin-generator
 */

import * as theia from '@theia/plugin';
import * as serveStatic from 'serve-static';
import * as http from 'http';
import * as finalhandler from 'finalhandler';

class StaticServer {

    server: http.Server | null = null;

    constructor(public options: { port: number }) { }

    serveOptions: serveStatic.ServeStaticOptions = {
        setHeaders(res, path) {
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3030');
        },
        cacheControl: false,
        etag: false
    }

    async start(path: string) {
        await this.stop();
        const serve = serveStatic(path, this.serveOptions);
        this.server = http.createServer((req, res) => {
            serve(req as any, res as any, finalhandler(req, res))
        });
        this.server.listen(this.options.port);
    }

    stop() {
        return new Promise(r => {
            if (this.server) this.server!.close(r)
            else r();
        });
    }
}

const server = new StaticServer({ port: 4000 });

export function start(context: theia.PluginContext) {
    theia.workspace.onDidChangeWorkspaceFolders(async (e) => {
        const { path } = e.added[0].uri;
        try {
            await server.start(path);
            const message = `Started workspace server serving ${path} on port ${server.options.port}`;
            theia.window.showInformationMessage(message);
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
