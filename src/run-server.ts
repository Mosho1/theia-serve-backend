import { StaticServer } from "./server";
import * as minimist from 'minimist';

const options = minimist(process.argv.slice(2), {
    default: {
        prefix: '',
        path: process.cwd()
    }
});

new StaticServer({ port: 4000 }).start(options.prefix, options.path);