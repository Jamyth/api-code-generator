import { spawn } from './utils';
import path from 'path';

console.info('Compiling...');
spawn('tsc', ['--project', path.join(__dirname, '../tsconfig.json')], 'Compile Failed');
