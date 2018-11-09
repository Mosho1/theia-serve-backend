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

class Cache {
    cacheDir = './cache';

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

    async read(path: string) {
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

    async write(path: string, data: string) {
        const cachePath = this.cachePath(path);
        await fs.writeFile(cachePath, data);
        debug(`wrote to cache: ${cachePath}`)
    }
}

class TSCompiler {
    cdn = `https://dev.jspm.io`;
    cache = new Cache();
    prefix = '__';
    getImportName(name:string) {
        return this.prefix + name.replace(/-/g, '_');
    }
    replaceImportWithCdn = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
            const specifier = node.moduleSpecifier;
            if (ts.isStringLiteral(specifier) && !specifier.text.startsWith('.')) {
                const newSpecifier = `${this.cdn}/${specifier.text}`;
                if (node.importClause &&
                    node.importClause.namedBindings) {
                    if (ts.isNamedImports(node.importClause.namedBindings)) {
                        const importName = this.getImportName(specifier.text);
                        const tempIdentifier = ts.createIdentifier(this.prefix + importName);
                        const importClause = ts.createImportClause(
                            undefined,
                            ts.createNamespaceImport(tempIdentifier));

                        const newImportDeclaration = ts.createImportDeclaration(
                            node.decorators,
                            node.modifiers,
                            importClause,
                            ts.createStringLiteral(newSpecifier));

                        const pickTheRightExport = ts.createVariableStatement(
                            undefined,
                            ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(
                                    ts.createIdentifier(importName),
                                    undefined,
                                    ts.createBinary(
                                        ts.createPropertyAccess(tempIdentifier, 'default'),
                                        ts.SyntaxKind.BarBarToken,
                                        tempIdentifier
                                    )
                                )
                            ])
                        );

                        const namedImports = ts.createVariableStatement(
                            undefined,
                            ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(
                                    ts.createObjectBindingPattern(node.importClause.namedBindings.elements.map(el =>
                                        ts.createBindingElement(undefined, el.propertyName, el.name))),
                                    undefined,
                                    ts.createIdentifier(importName)
                                )
                            ])
                        );

                        return [
                            newImportDeclaration,
                            pickTheRightExport,
                            namedImports
                        ];
                    }
                    if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                        const importName = node.importClause.namedBindings.name.escapedText.toString();
                        const tempIdentifier = ts.createIdentifier(this.getImportName(specifier.text));
                        const importClause = ts.createImportClause(
                            undefined,
                            ts.createNamespaceImport(tempIdentifier));

                        const newImportDeclaration = ts.createImportDeclaration(
                            node.decorators,
                            node.modifiers,
                            importClause,
                            ts.createStringLiteral(newSpecifier)
                        );

                        const pickTheRightExport = ts.createVariableStatement(
                            undefined,
                            ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(
                                    ts.createIdentifier(importName),
                                    undefined,
                                    ts.createBinary(
                                        ts.createPropertyAccess(tempIdentifier, 'default'),
                                        ts.SyntaxKind.BarBarToken,
                                        tempIdentifier
                                    )
                                )
                            ])
                        );

                        return [
                            newImportDeclaration,
                            pickTheRightExport
                        ];
                    }
                } else {
                    return ts.createImportDeclaration(
                        node.decorators,
                        node.modifiers,
                        node.importClause,
                        ts.createStringLiteral(newSpecifier)
                    )
                }
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

    async compile(path: string, { nocache = false } = {}) {
        if (!nocache) {
            const cached = await this.cache.read(path);
            if (cached) return cached;
        } else {
            debug('skipping cache');
        }
        const file = await fs.readFile(path);
        const { outputText } = ts.transpileModule(file.toString(), this.options);
        await this.cache.write(path, outputText);
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
            const filePath = join(path, req.originalUrl.split('?')[0]);
            const compiled = await this.tsCompiler.compile(filePath, req.query);
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
