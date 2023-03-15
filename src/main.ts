import { getInput, info, setOutput, setFailed, error } from '@actions/core';
// @ts-ignore
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const Particle = require('particle-api-js');
const particle = new Particle();

interface FileList {
    // Keys should be the filenames, including relative path.
    // Values should be a path or Buffer of the file contents.
    [key:string] : Buffer
}

export function getCode(path: string): FileList {
	const code : FileList = {};
	const dirData = readdirSync(path);
	dirData.forEach((file) => {
		const relativePath = path + '/' + file;
		code[relativePath] = Buffer.from(readFileSync(relativePath, 'utf8'));
	});
	return code;
}

// eslint-disable-next-line max-len
async function particleCompile(path: string, platformId: string, auth: string, targetVersion?: string): Promise<string | undefined> {
	info(`Compiling code in ${path}`);
	const files = getCode(path);
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
