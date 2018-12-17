import { StaticServer } from "./server";
import * as minimist from 'minimist';

interface Options {
    prefix: string;
    path: string;
    apiProxy: string;
}

const options = minimist<Options>(process.argv.slice(2), {
    default: {
        prefix: '',
        apiProxy: '',
        path: process.cwd()
    }
});

new StaticServer({ port: 4000 }).start(options);