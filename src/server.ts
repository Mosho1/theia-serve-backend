import * as serveStatic from 'serve-static';
import * as http from 'http';
import * as express from 'express';
import * as ts from 'typescript';
import * as fs from 'fs-extra';
import { join, resolve } from 'path';
import { TransformerFactory, SourceFile } from 'typescript';
import * as d from 'debug';
import { Request, Response } from 'express';
const debug = d('ts-server');

class TSCompiler {
    cdn = `https://dev.jspm.io`;
    cacheDir = './cache';

    replaceImportWithCdn = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
            const specifier = node.moduleSpecifier;
            if (ts.isStringLiteral(specifier) && !specifier.text.startsWith('.')) {
                const newSpecifier = `${this.cdn}/${specifier.text}`;
                return ts.createImportDeclaration(
                    node.decorators,
                    node.modifiers,
                    node.importClause,
                    ts.createStringLiteral(newSpecifier)
                )
            }
        }
        return node;
    }

    transformImports: TransformerFactory<SourceFile> = (context: any) => (node: any) => {
        return ts.visitEachChild(node, this.replaceImportWithCdn, context);
    };

    options: ts.TranspileOptions = {
        compilerOptions: {
            module: 5,
            target: 5
        },
        transformers: {
            after: [this.transformImports]
        }
    }


    constructor() {
        this.makeCacheDir();
    }


    async makeCacheDir() {
        try {
            await fs.mkdir(this.cacheDir);
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
        }
    }

    async stat(path: string) {
        try {
            return await fs.stat(path);
        } catch {
            const message = `could not find ${path}`;
            const error = new Error(message);
            (error as any).status = 404;
            throw error;
        }
    }

    cachePath(path: string) {
        return join(this.cacheDir, path.replace(/\//g, '__'));
    }

    async readCache(path: string) {
        try {
            const stat = await this.stat(path);
            const cachePath = this.cachePath(path);
            const cacheStat = await fs.stat(cachePath);
            if (cacheStat.mtime > stat.mtime) {
                debug(`found cached version of ${path}`)
                return await fs.readFile(cachePath);
            }
        } catch (e) {
            debug(e);
        }
        debug(`couldn't found cached version of ${path}`)
        return null;
    }

    async writeCache(path: string, data: string) {
        const cachePath = this.cachePath(path);
        await fs.writeFile(cachePath, data);
        debug(`wrote to cache: ${cachePath}`)
    }

    async compile(path: string) {
        const cached = await this.readCache(path);
        if (cached) return cached;
        const file = await fs.readFile(path);
        const { outputText } = ts.transpileModule(file.toString(), this.options);
        await this.writeCache(path, outputText)
        return outputText;
    }
}

export class StaticServer {

    server: http.Server | null = null;

    constructor(public options: { port: number }) { }

    tsCompiler = new TSCompiler();

    setHeaders(res: express.Response, path?: string) {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3030');
    }

    errorHandler(error: Error, req: Request, res: Response, next: (e?: Error) => void) {
        debug(error);
        next(error);
    }

    serveTsFiles = (path: string) => async (req: Request, res: Response, next: (e?: Error) => void) => {
        try {
            const filePath = join(path, req.originalUrl);
            const compiled = await this.tsCompiler.compile(filePath);
            this.setHeaders(res);
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(compiled);
        } catch (error) {
            next(error);
        }
    }

    async start(path: string) {
        await this.stop();

        const app = express();

        path = resolve(path);
        app.use('**/*.ts', this.serveTsFiles(path));
        app.use(serveStatic(path, { setHeaders: this.setHeaders }));
        app.use(this.errorHandler);

        this.server = app.listen(this.options.port);
    }

    stop() {
        return new Promise(r => {
            if (this.server) this.server!.close(r)
            else r();
        });
    }
}
