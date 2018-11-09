import * as serveStatic from 'serve-static';
import * as http from 'http';
import * as express from 'express';
import * as ts from 'typescript';
import * as fs from 'fs';
import { promisify } from 'util';
import { join, resolve } from 'path';
import { TransformerFactory, SourceFile } from 'typescript';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const existsAsync = promisify(fs.exists);
const mkdirAsync = promisify(fs.mkdir);

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

    transformImports: TransformerFactory<SourceFile> = (context) => (node) => {
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
        if (!(await existsAsync(this.cacheDir))) {
            await mkdirAsync(this.cacheDir);
        }
    }

    async compile(path: string) {
        const stat = await statAsync(path);
        const cachePath = join(this.cacheDir, path.replace(/\//g, '__'));
        try {
            const cacheStat = await statAsync(cachePath);
            if (cacheStat.mtime < stat.mtime) {
                return await readFileAsync(cachePath);
            }
        } catch(e) {
            
        }
        const file = await readFileAsync(path);
        const compiled = ts.transpileModule(file.toString(), this.options);
        await writeFileAsync(cachePath, compiled.outputText);
        return compiled.outputText;
    }
}

export class StaticServer {

    server: http.Server | null = null;

    constructor(public options: { port: number }) { }

    tsCompiler = new TSCompiler();

    setHeaders(res: express.Response, path?: string) {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3030');
    }

    async start(path: string) {
        path = resolve(path);
        await this.stop();
        const app = express();
        app.use('**/*.ts', async (req, res, next) => {
            const filePath = join(path, req.originalUrl);
            const compiled = await this.tsCompiler.compile(filePath);
            this.setHeaders(res);
            res.writeHead(200, { "Content-Type": "application/javascript" });
            res.end(compiled);
        });
        app.use(serveStatic(path, {setHeaders: this.setHeaders}));
        this.server = app.listen(this.options.port);
    }

    stop() {
        return new Promise(r => {
            if (this.server) this.server!.close(r)
            else r();
        });
    }
}
