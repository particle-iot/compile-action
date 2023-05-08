import { getInput, info, setFailed, setOutput } from '@actions/core';
import { dockerBuildpackCompile, dockerCheck } from './docker';
import { particleCloudCompile, particleDownloadBinary } from './particle-api';
import { renameFile, resolveVersion, validatePlatformDeviceOsTarget, validatePlatformName, preprocessSources } from './util';
import { incrementVersion, isProductFirmware, shouldIncrementVersion } from './autoversion';
import { currentFirmwareVersion, findNearestGitRoot, findProductVersionMacroFile, hasFullHistory } from './git';

interface ActionInputs {
	auth: string;
	platform: string;
	sources: string;
	autoVersionEnabled: boolean;
	versionMacroName: string;
	targetVersion: string;
}

interface ActionOutputs {
	artifactPath: string;
	deviceOsVersion: string;
	firmwareVersion: number | undefined;
	firmwareVersionUpdated: boolean;
}

async function resolveInputs(): Promise<ActionInputs> {
	const auth: string = getInput('particle-access-token');
	const platform: string = getInput('particle-platform-name');
	const version: string = getInput('device-os-version');
	const sources: string = getInput('sources-folder');
	const autoVersionEnabled: boolean = getInput('auto-version') === 'true';
	const versionMacroName: string = getInput('auto-version-macro-name');

	validatePlatformName(platform);

	const targetVersion = await resolveVersion(platform, version);

	await validatePlatformDeviceOsTarget(platform, targetVersion);

	return { auth, platform, sources, autoVersionEnabled, versionMacroName, targetVersion };
}

function setOutputs(
	{ artifactPath, deviceOsVersion, firmwareVersion, firmwareVersionUpdated }: ActionOutputs
): void {
	setOutput('artifact-path', artifactPath);
	setOutput('device-os-version', deviceOsVersion);
	setOutput('firmware-version', firmwareVersion);
	setOutput('firmware-version-updated', firmwareVersionUpdated);
}

export async function autoVersion(
	{ sources, gitRepo, autoVersionEnabled, versionMacroName }: {
		sources: string;
		gitRepo: string;
		autoVersionEnabled: boolean;
		versionMacroName: string;
	}
): Promise<{
	versionFile: string | undefined;
	version: number | undefined;
	incremented: boolean;
}> {
	let versionFile: string | undefined;
	let version: number | undefined;
	let incremented = false;
	if (autoVersionEnabled) {
		const validGitRepo = await hasFullHistory({ gitRepo });
		const productFirmware = await isProductFirmware({
			sources, productVersionMacroName: versionMacroName
		});
		if (!validGitRepo) {
			throw new Error('Auto-versioning is enabled, but the git repository does not appear to have a full history. Try setting `fetch-depth: 0` on `actions/checkout` to fetch all history for all branches and tags.');
		}
		if (!productFirmware) {
			throw new Error('Auto-versioning is enabled, but the firmware does not appear to be a product firmware. The version macro could not be found. Please disable auto-versioning or specify the correct macro name.');
		}
		info('Auto-versioning is enabled, checking if firmware version should be incremented');
		versionFile = await findProductVersionMacroFile({
			sources: sources,
			productVersionMacroName: versionMacroName
		});
		version = await currentFirmwareVersion({
			gitRepo: gitRepo,
			versionFilePath: versionFile,
			productVersionMacroName: versionMacroName
		});

		const shouldVersion = await shouldIncrementVersion({
			gitRepo, sources, productVersionMacroName: versionMacroName
		});
		if (shouldVersion) {
			const out = await incrementVersion({
				gitRepo,
				sources,
				productVersionMacroName: versionMacroName
			});
			version = out.version;
			versionFile = out.file;
			incremented = true;
		}
	} else {
		info('Auto-versioning is disabled, only doing version check');
		try {
			versionFile = await findProductVersionMacroFile({
				sources: sources,
				productVersionMacroName: versionMacroName
			});
			version = await currentFirmwareVersion({
				gitRepo: gitRepo,
				versionFilePath: versionFile,
				productVersionMacroName: versionMacroName
			});
		} catch (e) {
			info('Could not find current product version macro, firmware-verion output will be undefined.');
		}
	}

	return { versionFile, version, incremented };
}

export async function compile(
	{ auth, platform, sources, targetVersion }: {
		auth: string;
		platform: string;
		sources: string;
		targetVersion: string;
	}
): Promise<{
	outputPath: string | undefined;
}> {
	let outputPath: string | undefined;
	if (!auth) {
		info('No access token provided, running local compilation');
		await dockerCheck();
		// Preprocesses .ino files into .cpp files
		// The cloud compiler does this automatically
		preprocessSources(sources);
		outputPath = await dockerBuildpackCompile({ sources, platform, targetVersion, workingDir: process.cwd() });
	} else {
		info('Access token provided, running cloud compilation');
		const binaryId = await particleCloudCompile({ sources, platform, targetVersion, auth });
		if (!binaryId) {
			throw new Error('Failed to compile code in cloud');
		}
		outputPath = await particleDownloadBinary({ binaryId, auth });
	}
	return { outputPath };
}

export async function compileAction(): Promise<void> {
	try {
		const { auth, platform, sources, autoVersionEnabled, versionMacroName, targetVersion } = await resolveInputs();

		const gitRepo = await findNearestGitRoot({ startingPath: sources });
		const { version, incremented } = await autoVersion({
			sources, gitRepo, autoVersionEnabled, versionMacroName
		});

		const { outputPath } = await compile(
			{ auth, platform, sources, targetVersion }
		);

		if (outputPath) {
			const artifactPath = renameFile({
				filePath: outputPath,
				platform,
				version: targetVersion
			});

			setOutputs({
				artifactPath: artifactPath,
				deviceOsVersion: targetVersion,
				firmwareVersion: version,
				firmwareVersionUpdated: incremented
			});
		} else {
			setFailed(`Failed to compile code in '${sources}'`);
		}
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		}
	}
}
