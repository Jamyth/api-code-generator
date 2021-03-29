import { spawn } from './utils';
import path from 'path';

console.info('Linting...');
spawn('eslint', ['--ext', path.join(__dirname, '../src')], 'Lint error, please fix!');
