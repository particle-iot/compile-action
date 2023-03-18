import { getInput, info, setOutput, setFailed, error, warning } from '@actions/core';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

// @ts-ignore
import { _handleMultiFileArgs, populateFileMapping } from './cli';
import { execa } from 'execa';

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
async function particleCloudCompile(path: string, platformId: string, auth: string, targetVersion?: string): Promise<string | undefined> {
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
			info(`Creating directory ${destDir}...`);
			mkdirSync(destDir);
		}
		writeFileSync(`${outputPath}`, resp, 'utf8');

		info(`File written to ${outputPath} successfully.`);
		return outputPath;
	}
}

// @todo: need translations for buildpack tags
async function dockerBuildpackCompile(workingDir: string, sources: string, platform: string, target: string) {
	// Note: the buildpack only detects *.c and *.cpp files
	// https://github.com/particle-iot/device-os/blob/196d497dd4c16ab83db6ea610cf2433047226a6a/user/build.mk#L64-L65

	info(`Fetching docker buildpack for platform ${platform} and target ${target}`);
	info(`This can take a minute....`);
	const dockerPull = await execa('docker', [
		'pull',
		`particle/buildpack-particle-firmware:4.0.2-argon`
	]);
	info(dockerPull.stdout);

	const destDir = 'output';
	const destName = 'firmware.bin';

	const outputPath = `${destDir}/${destName}`;
	if (!existsSync(destDir)){
		info(`Creating output directory ${destDir}...`);
		mkdirSync(destDir);
	} else {
		warning(`Output directory ${destDir} already exists. Compile will overwrite firmware.bin if it exists.`);
	}

	const args = [
		'run',
		'--rm',
		'-v',
		`${workingDir}/${sources}:/input`,
		'-v',
		`${workingDir}/${destDir}:/output`,
		'-e',
		`PLATFORM_ID=${platform}`,
		`particle/buildpack-particle-firmware:4.0.2-argon`
	];
	const dockerRun = await execa('docker', args);
	info(dockerRun.stdout);

	return outputPath;
}

async function run(): Promise<void> {
	try {
		const accessToken: string = getInput('particle_access_token');
		const platform: string = getInput('particle_platform_name');
		const target: string = getInput('device_os_version');
		const sources: string = getInput('sources_folder');

		let outputPath: string | undefined;
		if (!accessToken) {
			info('No access token provided, running local compilation');
			outputPath = await dockerBuildpackCompile(process.cwd(), sources, platform, target);
		} else {
			info('Access token provided, running cloud compilation');
			const binaryId = await particleCloudCompile(sources, platform, accessToken, target);
			if (!binaryId) {
				throw new Error('Failed to compile code in cloud');
			}
			outputPath = await particleDownloadBinary(binaryId, accessToken);
		}

		if (outputPath) {
			setOutput('artifact_path', outputPath);
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
