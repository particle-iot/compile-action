import { getInput, info, setFailed, setOutput } from '@actions/core';
import { particleCloudCompile, particleDownloadBinary } from './particle';
import { dockerBuildpackCompile } from './docker';

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
