import { getInput, info, setOutput, setFailed, error } from '@actions/core';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
// @ts-ignore
import { _handleMultiFileArgs, populateFileMapping } from './cli';

const Particle = require('particle-api-js');
const particle = new Particle();

// us
export function getCode(path: string) {
	const fileMapping = _handleMultiFileArgs([path]);
	populateFileMapping(fileMapping);
	// @ts-ignore
	if (Object.keys(fileMapping.map).length === 0){
		throw new Error('no files included');
	}
	// @ts-ignore
	return fileMapping.map || fileMapping;
}

// eslint-disable-next-line max-len
async function particleCompile(path: string, platformId: string, auth: string, targetVersion?: string): Promise<string | undefined> {
	info(`Compiling code in ${path}`);
	if (!path) {
		throw new Error('No source code path specified');
	}

	if (path === './' || path === '.') {
		path = __dirname;
	}

	const files = getCode(path);

	info(`Compiling code for platform ${platformId} with target version ${targetVersion}`);
	info(`Files: ${JSON.stringify(Object.keys(files))}`);

	// handle internal implementation detail of the particle-api-js compile command
	if (targetVersion === 'latest') {
		targetVersion = undefined;
	}

	const resp = await particle.compileCode({
		files,
		platformId,
		targetVersion,
		auth
	});

	const body = resp.body;
	if (body.ok) {
		info(`Code compiled successfully. Binary ID: ${body.binary_id}`);
		return body.binary_id;
	}

	error(`Error compiling code:\n\n${body.errors}`);
	setFailed(body.output);
}

async function particleDownloadBinary(binaryId: string, auth: string): Promise<string | undefined> {
	info(`Downloading binary ${binaryId}`);
	const resp = await particle.downloadFirmwareBinary({
		binaryId,
		auth
	});
	if (resp instanceof Buffer) {
		info(`Binary downloaded successfully.`);
		const destDir = 'output';
		const destName = 'firmware.bin';

		const outputPath = `${destDir}/${destName}`;
		if (!existsSync(destDir)){
			console.log(`Creating directory ${destDir}...`);
			mkdirSync(destDir);
		}
		writeFileSync(`${outputPath}`, resp, 'utf8');

		info(`File written to ${outputPath} successfully.`);
		return outputPath;
	}
}

async function run(): Promise<void> {
	try {
		const accessToken: string = getInput('particle_access_token');
		const platform: string = getInput('particle_platform_name');
		const target: string = getInput('device_os_version');
		const sources: string = getInput('sources_folder');

		const binaryId = await particleCompile(sources, platform, accessToken, target);
		if (binaryId) {
			const outputPath = await particleDownloadBinary(binaryId, accessToken);
			setOutput('path_to_binary', outputPath);
		} else {
			setFailed(`Failed to compile code in ${sources}`);
		}
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		}
	}
}

run();
