// eslint-disable-next-line max-len
import { error, info, setFailed } from '@actions/core';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { getCode, getPlatformId } from './util';

const ParticleApi = require('particle-api-js');
const particle = new ParticleApi();

// eslint-disable-next-line max-len
export async function particleCloudCompile(path: string, platform: string, auth: string, targetVersion?: string): Promise<string | undefined> {
	info(`Compiling code in ${path}`);
	if (!path) {
		throw new Error('No source code path specified');
	}

	if (path === './' || path === '.') {
		path = process.cwd();
	}

	// todo: need validation on target/platform compatibility
	const platformId = getPlatformId(platform);

	const files = getCode(path);

	info(`Compiling code for platform '${platform}' with target version '${targetVersion}'`);
	info(`Files: ${JSON.stringify(Object.keys(files))}`);

	// handle internal implementation detail of the particle-api-js compile command
	if (targetVersion === 'latest') {
		targetVersion = undefined;
	}

	const resp = await particle.compileCode({
		files,
		platformId,
		targetVersion,
		auth,
		headers: { 'User-Agent': 'particle-compile-action' }
	});

	const body = resp.body;
	if (body.ok) {
		info(`Code compiled successfully. Binary ID: '${body.binary_id}'`);
		return body.binary_id;
	}

	error(`Error compiling code:\n\n${body.errors}`);
	setFailed(body.output);
}

export async function particleDownloadBinary(binaryId: string, auth: string): Promise<string | undefined> {
	info(`Downloading binary ${binaryId}`);
	const resp = await particle.downloadFirmwareBinary({
		binaryId,
		auth,
		headers: { 'User-Agent': 'particle-compile-action' }
	});
	if (resp instanceof Buffer) {
		info(`Binary downloaded successfully.`);
		const destDir = 'output';
		const destName = 'firmware.bin';

		const outputPath = `${destDir}/${destName}`;
		if (!existsSync(destDir)){
			info(`Creating directory ${destDir}...`);
			mkdirSync(destDir);
		}
		writeFileSync(`${outputPath}`, resp, 'utf8');

		info(`File written to ${outputPath} successfully.`);
		return outputPath;
	}
}
