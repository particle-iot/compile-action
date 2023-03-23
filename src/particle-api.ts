// eslint-disable-next-line max-len
import { error, info } from '@actions/core';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { getCode, getPlatformId } from './util';

const ParticleApi = require('particle-api-js');
const particle = new ParticleApi();

// eslint-disable-next-line max-len
export async function particleCloudCompile(path: string, platform: string, auth: string, targetVersion?: string): Promise<string> {
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

	let binaryId = '';
	try {
		const resp = await particle.compileCode({
			files,
			platformId,
			targetVersion,
			auth,
			headers: { 'User-Agent': 'particle-compile-action' }
		});
		const body = resp.body;
		if (!body || !body.binary_id) {
			throw new Error(`Error: unknown response from Particle Cloud: ${JSON.stringify(resp)}`);
		}
		info(`Code compiled successfully. Binary ID: '${body.binary_id}'`);
		binaryId = body.binary_id;
	} catch (e: any) {
		// Log custom error response from Particle API
		// Specifically this is stdout from the compiler (why the compile failed)
		if (e.body && e.body.output && e.body.errors) {
			error(`${e.body.output}\n${e.body.errors}`);
		} else {
			throw e;
		}
	}

	return binaryId;
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
