import { getInput, info, setFailed, setOutput } from '@actions/core';
import { dockerBuildpackCompile, dockerCheck } from './docker';
import { particleCloudCompile, particleDownloadBinary } from './particle-api';
import { resolveVersion, validatePlatformDeviceOsTarget, validatePlatformName } from './util';

export async function compileAction(): Promise<void> {
	try {
		const auth: string = getInput('particle-access-token');
		const platform: string = getInput('particle-platform-name');
		const version: string = getInput('device-os-version');
		const sources: string = getInput('sources-folder');

		validatePlatformName(platform);

		const targetVersion = await resolveVersion(platform, version);
		await validatePlatformDeviceOsTarget(platform, targetVersion);

		let outputPath: string | undefined;
		if (!auth) {
			info('No access token provided, running local compilation');
			await dockerCheck();
			outputPath = await dockerBuildpackCompile({ sources, platform, targetVersion, workingDir: process.cwd() });
		} else {
			info('Access token provided, running cloud compilation');
			const binaryId = await particleCloudCompile({ sources, platform, targetVersion, auth });
			if (!binaryId) {
				throw new Error('Failed to compile code in cloud');
			}
			outputPath = await particleDownloadBinary({ binaryId, auth });
		}

		if (outputPath) {
			setOutput('artifact-path', outputPath);
			setOutput('device-os-version', targetVersion);
		} else {
			setFailed(`Failed to compile code in '${sources}'`);
		}
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		}
	}
}
