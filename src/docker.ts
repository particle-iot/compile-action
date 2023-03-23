// @todo: need translations for buildpack tags
import { info, warning } from '@actions/core';
import { existsSync, mkdirSync } from 'fs';
import execa from 'execa';
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

export async function dockerBuildpackCompile(workingDir: string, sources: string, platform: string, target: string) {
	// Note: the buildpack only detects *.c and *.cpp files
	// https://github.com/particle-iot/device-os/blob/196d497dd4c16ab83db6ea610cf2433047226a6a/user/build.mk#L64-L65

	info(`Fetching docker buildpack for platform '${platform}' and target '${target}'`);
	info(`This can take a minute....`);
	const dockerPull = await execa('docker', [
		'pull',
		`particle/buildpack-particle-firmware:4.0.2-argon`
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
