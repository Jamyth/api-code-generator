import axios from 'axios';
import fs from 'fs';
import { Agent } from 'https';
import { spawnSync } from 'child_process';
import path from 'path';
import type {
    PlatformConfig,
    APIGeneratorOptions,
    APIDefinition,
    TypeDefinition,
    ServiceDefinition,
    Operation,
} from './type';

export class APIGeneratorBase {
    private readonly metadataEndpointURL: string;
    private readonly typeFilePath: string;
    private readonly serviceFolderPath: string;
    private readonly platformConfig: PlatformConfig;

    private readonly logger = console.info;

    constructor({ metadataEndpointURL, typeFilePath, serviceFolderPath, platformConfig }: APIGeneratorOptions) {
        this.metadataEndpointURL = metadataEndpointURL;
        this.typeFilePath = typeFilePath;
        this.serviceFolderPath = serviceFolderPath;
        this.platformConfig = platformConfig;
    }

    async run() {
        try {
            const { services, types } = await this.fetchAPIDefinition();
            await Promise.all([
                this.generateTypeFile(types, this.typeFilePath),
                this.generateServiceFolder(services, this.serviceFolderPath, this.platformConfig),
            ]);
        } catch (e) {
            this.logger(e);
            process.exit(1);
        }
    }

    private async fetchAPIDefinition() {
        this.logger('Fetching API meta data', this.metadataEndpointURL);

        const response = await axios.get<APIDefinition>(this.metadataEndpointURL, {
            httpsAgent: new Agent({ rejectUnauthorized: false }),
        });
        const contentType = response.headers['content-type'];
        let api: APIDefinition;

        if (contentType && contentType.startsWith('application/json')) {
            api = response.data;
        } else {
            throw new Error(`Unexpected contentType: ${contentType}`);
        }

        if (api?.services && api?.types) {
            return api;
        } else {
            throw new Error(`Unexpected response: ${JSON.stringify(api)}}`);
        }
    }

    private async generateTypeFile(types: TypeDefinition[], filePath: string) {
        if (!types.length) return;
        this.logger('Generating API Type File', this.typeFilePath);

        const comment = '// Attention: This file is generated by "yarn api", do not modify\n';
        const typeDefinitions = types.map((type) => `export ${type.type} ${type.name} ${type.definition}`);
        const content = [comment, ...typeDefinitions].join('\n');

        await fs.promises.writeFile(filePath, content, { encoding: 'utf8' });
        spawnSync('prettier', [filePath, '--write']);
    }

    private async generateServiceFolder(
        services: ServiceDefinition[],
        folderPath: string,
        platformInfo: PlatformConfig,
    ) {
        if (!services.length) return;
        const folderExist = fs.existsSync(folderPath);
        if (folderExist) {
            if (fs.statSync(folderPath).isDirectory()) {
                fs.rmdirSync(folderPath, { recursive: true });
            } else {
                throw new Error(`Path ${folderPath} is not a directory`);
            }
        }
        fs.mkdirSync(folderPath, { recursive: true });

        this.logger('Generating API Service Files', folderPath);

        const differenceSet = <T>(A: T[], B: T[]) => {
            const a = new Set(A);
            const b = new Set(B);
            return Array.from(a).filter((_) => !b.has(_));
        };

        const extractTypes = (operation: Operation) => {
            const { pathParams, requestType, responseType } = operation;
            const types = [...pathParams.map((param) => param.type), requestType, responseType];
            return types.map((type) => type?.replace('[]', ''));
        };

        const typesImportStatement = (service: ServiceDefinition) => {
            const primitiveTypes = ['void', 'number', 'string', 'boolean'];
            const requireTypes = service.operations
                .reduce((acc, curr) => acc.concat(extractTypes(curr)), [] as (string | undefined)[])
                .filter(Boolean);
            const customTypes = [...differenceSet(requireTypes, primitiveTypes)];

            return customTypes.length
                ? `import type { ${customTypes.join(',')} } from "${platformInfo.typeFileImportPath}";`
                : '';
        };

        const methodDeclaration = (operation: Operation) => {
            const { name, method, path: endpoint, pathParams, requestType, responseType } = operation;
            const requestBody = requestType ? [{ name: 'request', type: requestType }] : [];
            const parameters = [...pathParams, ...requestBody]
                .map((parameter) => `${parameter.name}: ${parameter.type}`)
                .join(',');
            const requestParams = pathParams.map((param) => param.name).join(',');
            const request = requestType ? 'request' : 'null';

            return `
                static ${name}(${parameters}): Promise<${responseType}> {
                    return ${platformInfo.ajaxFunction(method, endpoint, requestParams, request)}
                }
            `;
        };

        const classDeclaration = (service: ServiceDefinition) => {
            const { name, operations } = service;
            const methods = operations.map(methodDeclaration).join('\n');
            return `export class ${name} { ${methods} }`;
        };

        const comment = '// Attention: This file is generated by "yarn api", do not modify\n';

        let count = 0;
        await Promise.all(
            services.map(async (service) => {
                const content = [
                    typesImportStatement(service),
                    platformInfo.ajaxFunctionImportStatement,
                    comment,
                    classDeclaration(service),
                ].join('\n');
                const filename = `${folderPath}/${service.name}.ts`;

                await fs.promises.writeFile(filename, content, { encoding: 'utf8' });
                console.info(`(${++count}) ${service.name} Generated`);
            }),
        );
        spawnSync('prettier', [path.join(folderPath, '/**/*.{css,html,js,json,jsx,less,ts,tsx}'), '--write']);
    }
}
