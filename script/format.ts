import { spawn } from './utils';
import path from 'path';

console.info('Formatting...');
spawn('prettier', ['--write', path.join(__dirname, '../src')], 'Cannot Format with prettier.');
