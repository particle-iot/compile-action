import { info, warning } from '@actions/core';
import { existsSync, mkdirSync } from 'fs';
import execa from 'execa';
import { getPlatformId } from './util';
import path from 'path';

export async function dockerCheck(): Promise<boolean> {
	let dockerVersion;
	try {
		dockerVersion = await execa('docker', ['version']);
	} catch (e) {
		const msg = dockerVersion?.stdout || dockerVersion?.stderr || String(e);
		info(msg);
		throw new Error(`Docker is not installed or is not available in the path.`);
	}
	return true;
}

export async function dockerBuildpackCompile(
	{ workingDir, sources, platform, targetVersion }: {
		workingDir: string;
		sources: string;
		platform: string;
		targetVersion: string;
	}
): Promise<string> {
	// Note: the buildpack only detects *.c and *.cpp files
	// https://github.com/particle-iot/device-os/blob/196d497dd4c16ab83db6ea610cf2433047226a6a/user/build.mk#L64-L65

	info(`Fetching docker buildpack. This can take a minute...`);
	const dockerPull = await execa('docker', [
		'pull',
		`particle/buildpack-particle-firmware:${targetVersion}-${platform}`
	]);
	info(dockerPull.stdout);

	const destDir = 'output';
	const destName = 'firmware.bin';

	const outputPath = `${destDir}/${destName}`;
	if (!existsSync(destDir)) {
		info(`Creating output directory ${destDir}...`);
		mkdirSync(destDir);
	} else {
		warning(`Output directory ${destDir} already exists. Compile will overwrite firmware.bin if it exists.`);
	}

	info(`Compiling code in '${sources}' for platform '${platform}' with target version '${targetVersion}'`);
	const inputDir = path.isAbsolute(sources) ? sources : path.join(workingDir, sources);
	const platformId = getPlatformId(platform);
	const args = [
		'run',
		'--rm',
		'-v',
		`${inputDir}:/input`,
		'-v',
		`${workingDir}/${destDir}:/output`,
		'-e',
		`PLATFORM_ID=${platformId}`,
		`particle/buildpack-particle-firmware:${targetVersion}-${platform}`
	];
	const dockerRun = await execa('docker', args);
	info(dockerRun.stdout);

	return outputPath;
}
