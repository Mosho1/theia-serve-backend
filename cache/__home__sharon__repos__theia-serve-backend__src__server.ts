import * as __express from "https://dev.jspm.io/express";
var express = __express.default || __express;
import * as __typescript from "https://dev.jspm.io/typescript";
var ts = __typescript.default || __typescript;
import * as __fs_extra from "https://dev.jspm.io/fs-extra";
var fs = __fs_extra.default || __fs_extra;
import * as ____path from "https://dev.jspm.io/path";
var __path = ____path.default || ____path;
var { join, resolve } = __path;
import * as __debug from "https://dev.jspm.io/debug";
var d = __debug.default || __debug;
const debug = d('ts-server');
class Cache {
    constructor() {
        this.cacheDir = './cache';
        this.makeCacheDir();
    }
    async makeCacheDir() {
        try {
            await fs.mkdir(this.cacheDir);
        }
        catch (e) {
            if (e.code !== 'EEXIST')
                throw e;
        }
    }
    async stat(path) {
        try {
            return await fs.stat(path);
        }
        catch (_a) {
            const message = `could not find ${path}`;
            const error = new Error(message);
            error.status = 404;
            throw error;
        }
    }
    cachePath(path) {
        return join(this.cacheDir, path.replace(/\//g, '__'));
    }
    async read(path) {
        try {
            const stat = await this.stat(path);
            const cachePath = this.cachePath(path);
            const cacheStat = await fs.stat(cachePath);
            if (cacheStat.mtime > stat.mtime) {
                debug(`found cached version of ${path}`);
                return await fs.readFile(cachePath);
            }
        }
        catch (e) {
            debug(e);
        }
        debug(`couldn't found cached version of ${path}`);
        return null;
    }
    async write(path, data) {
        const cachePath = this.cachePath(path);
        await fs.writeFile(cachePath, data);
        debug(`wrote to cache: ${cachePath}`);
    }
}
class TSCompiler {
    constructor() {
        this.cdn = `https://dev.jspm.io`;
        this.cache = new Cache();
        this.prefix = '__';
        this.replaceImportWithCdn = (node) => {
            if (ts.isImportDeclaration(node)) {
                const specifier = node.moduleSpecifier;
                if (ts.isStringLiteral(specifier) && !specifier.text.startsWith('.')) {
                    const newSpecifier = `${this.cdn}/${specifier.text}`;
                    if (node.importClause &&
                        node.importClause.namedBindings) {
                        if (ts.isNamedImports(node.importClause.namedBindings)) {
                            const importName = this.getImportName(specifier.text);
                            const tempIdentifier = ts.createIdentifier(this.prefix + importName);
                            const importClause = ts.createImportClause(undefined, ts.createNamespaceImport(tempIdentifier));
                            const newImportDeclaration = ts.createImportDeclaration(node.decorators, node.modifiers, importClause, ts.createStringLiteral(newSpecifier));
                            const pickTheRightExport = ts.createVariableStatement(undefined, ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(ts.createIdentifier(importName), undefined, ts.createBinary(ts.createPropertyAccess(tempIdentifier, 'default'), ts.SyntaxKind.BarBarToken, tempIdentifier))
                            ]));
                            const namedImports = ts.createVariableStatement(undefined, ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(ts.createObjectBindingPattern(node.importClause.namedBindings.elements.map(el => ts.createBindingElement(undefined, el.propertyName, el.name))), undefined, ts.createIdentifier(importName))
                            ]));
                            return [
                                newImportDeclaration,
                                pickTheRightExport,
                                namedImports
                            ];
                        }
                        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
                            const importName = node.importClause.namedBindings.name.escapedText.toString();
                            const tempIdentifier = ts.createIdentifier(this.getImportName(specifier.text));
                            const importClause = ts.createImportClause(undefined, ts.createNamespaceImport(tempIdentifier));
                            const newImportDeclaration = ts.createImportDeclaration(node.decorators, node.modifiers, importClause, ts.createStringLiteral(newSpecifier));
                            const pickTheRightExport = ts.createVariableStatement(undefined, ts.createVariableDeclarationList([
                                ts.createVariableDeclaration(ts.createIdentifier(importName), undefined, ts.createBinary(ts.createPropertyAccess(tempIdentifier, 'default'), ts.SyntaxKind.BarBarToken, tempIdentifier))
                            ]));
                            return [
                                newImportDeclaration,
                                pickTheRightExport
                            ];
                        }
                    }
                    else {
                        return ts.createImportDeclaration(node.decorators, node.modifiers, node.importClause, ts.createStringLiteral(newSpecifier));
                    }
                }
            }
            return node;
        };
        this.transformImports = (context) => (node) => {
            return ts.visitEachChild(node, this.replaceImportWithCdn, context);
        };
        this.options = {
            compilerOptions: {
                module: 5,
                target: 5
            },
            transformers: {
                after: [this.transformImports]
            }
        };
    }
    getImportName(name) {
        return this.prefix + name.replace(/[^a-z0-9]/ig, '_');
    }
    async compile(path, { nocache = false } = {}) {
        if (!nocache) {
            const cached = await this.cache.read(path);
            if (cached)
                return cached;
        }
        else {
            debug('skipping cache');
        }
        const file = await fs.readFile(path);
        const { outputText } = ts.transpileModule(file.toString(), this.options);
        await this.cache.write(path, outputText);
        return outputText;
    }
}
export class StaticServer {
    constructor(options) {
        this.options = options;
        this.server = null;
        this.tsCompiler = new TSCompiler();
        this.serveTsFiles = (virtualPath, path) => async (req, res, next) => {
            try {
                const filePath = join(path, req.originalUrl.split('?')[0]).replace(virtualPath, '').replace(/\/\//g, '/');
                const compiled = await this.tsCompiler.compile(filePath, req.query);
                this.setHeaders(res);
                res.writeHead(200, { "Content-Type": "application/javascript" });
                res.end(compiled);
            }
            catch (error) {
                next(error);
            }
        };
    }
    setHeaders(res, path) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    errorHandler(error, req, res, next) {
        debug(error);
        next(error);
    }
    async start(virtualPath, staticPath) {
        await this.stop();
        const app = express();
        staticPath = resolve(staticPath);
        app.use('**/*.(ts|js)', this.serveTsFiles(virtualPath, staticPath));
        app.use(this.errorHandler);
        this.server = app.listen(this.options.port);
    }
    stop() {
        return new Promise(r => {
            if (this.server)
                this.server.close(r);
            else
                r();
        });
    }
}
