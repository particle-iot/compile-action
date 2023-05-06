// eslint-disable-next-line max-len
import { error, info } from '@actions/core';
import { writeFileSync } from 'fs';
import { getCode, getPlatformId } from './util';

const ParticleApi = require('particle-api-js');
const particle = new ParticleApi();

export async function particleCloudCompile(
	{ sources, platform, auth, targetVersion }: {
		sources: string;
		platform: string;
		auth: string;
		targetVersion: string;
	}
): Promise<string> {
	info(`Compiling code in '${sources}' for platform '${platform}' with target version '${targetVersion}'`);
	if (!sources) {
		throw new Error('No source code sources specified');
	}

	if (sources === './' || sources === '.') {
		sources = process.cwd();
	}


	const files = getCode(sources);
	info(`Files: ${JSON.stringify(Object.keys(files))}`);

	const platformId = getPlatformId(platform);
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

export async function particleDownloadBinary(
	{ binaryId, auth, platform, targetVersion }: {
		binaryId: string;
		auth: string;
		platform: string;
		targetVersion: string;
	}
): Promise<string | undefined> {
	info(`Downloading binary ${binaryId}`);
	const resp = await particle.downloadFirmwareBinary({
		binaryId,
		auth,
		headers: { 'User-Agent': 'particle-compile-action' }
	});
	if (resp instanceof Buffer) {
		info(`Binary downloaded successfully.`);
		const destName = `firmware-${platform}-${targetVersion}.bin`;
		const outputPath = `${destName}`;
		writeFileSync(`${outputPath}`, resp, 'utf8');
		info(`File downloaded successfully.`);
		return outputPath;
	}
}
