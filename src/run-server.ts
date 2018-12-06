import { StaticServer } from "./server";
import * as minimist from 'minimist';

interface Options {
    prefix: string;
    path: string;
}

const options = minimist<Options>(process.argv.slice(2), {
    default: {
        prefix: '',
        path: process.cwd()
    }
});

new StaticServer({ port: 4000 }).start(options);