import { spawnSync } from 'child_process';
import chalk from 'chalk';

export const spawn = (command: string, args: string[], errorMessage: string) => {
    const isWindow = process.platform === 'win32';
    const result = spawnSync(isWindow ? command + '.cmd' : command, args);
    if (result.error) {
        console.error(result.error);
        process.exit(1);
    }
    if (result.status !== 0) {
        console.info(chalk`{red.bold ${errorMessage}}`);
        console.info(`Non-zero status returned. command -- ${command} ${args.join(' ')}`);
        process.exit(1);
    }
};
