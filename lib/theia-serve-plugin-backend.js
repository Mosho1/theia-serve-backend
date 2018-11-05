"use strict";
/**
 * Generated using theia-plugin-generator
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var theia = require("@theia/plugin");
var serveStatic = require("serve-static");
var http = require("http");
var finalhandler = require("finalhandler");
var StaticServer = /** @class */ (function () {
    function StaticServer(options) {
        this.options = options;
        this.server = null;
        this.serveOptions = {
            setHeaders: function (res, path) {
                res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3030');
            },
            cacheControl: false,
            etag: false
        };
    }
    StaticServer.prototype.start = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var serve;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.stop()];
                    case 1:
                        _a.sent();
                        serve = serveStatic(path, this.serveOptions);
                        this.server = http.createServer(function (req, res) {
                            serve(req, res, finalhandler(req, res));
                        });
                        this.server.listen(this.options.port);
                        return [2 /*return*/];
                }
            });
        });
    };
    StaticServer.prototype.stop = function () {
        var _this = this;
        return new Promise(function (r) {
            if (_this.server)
                _this.server.close(r);
            else
                r();
        });
    };
    return StaticServer;
}());
var server = new StaticServer({ port: 4000 });
function start(context) {
    var _this = this;
    theia.workspace.onDidChangeWorkspaceFolders(function (e) { return __awaiter(_this, void 0, void 0, function () {
        var path, message, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = e.added[0].uri.path;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, server.start(path)];
                case 2:
                    _a.sent();
                    message = "Started workspace server serving " + path + " on port " + server.options.port;
                    theia.window.showInformationMessage(message);
                    console.log(message);
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    theia.window.showErrorMessage(e_1.message);
                    console.error(e_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
}
exports.start = start;
function stop() {
    return server.stop();
}
exports.stop = stop;
//# sourceMappingURL=theia-serve-plugin-backend.js.map