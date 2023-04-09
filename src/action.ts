import { getInput, info, setFailed, setOutput } from '@actions/core';
import { dockerBuildpackCompile, dockerCheck } from './docker';
import { particleCloudCompile, particleDownloadBinary } from './particle-api';
import { resolveVersion, validatePlatformDeviceOsTarget, validatePlatformName } from './util';
import { incrementVersion, isProductFirmware, shouldIncrementVersion } from './versioning';
import { currentFirmwareVersion, findNearestGitRoot, findProductVersionMacroFile } from './git';

interface ActionInputs {
	auth: string;
	platform: string;
	sources: string;
	autoVersionEnabled: boolean;
	versionMacroName: string;
	targetVersion: string;
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

interface AutoVersionParams {
	sources: string;
	gitRepo: string;
	autoVersionEnabled: boolean;
	versionMacroName: string;
}

interface AutoVersionResult {
	autoVersionFile: string | undefined;
	autoVersionNext: number | undefined;
	incremented: boolean;
}

export async function autoVersion(
	{ sources, gitRepo, autoVersionEnabled, versionMacroName }: AutoVersionParams
): Promise<AutoVersionResult> {
	let autoVersionFile: string | undefined;
	let autoVersionNext: number | undefined;
	let incremented = false;
	if (autoVersionEnabled) {
		const productFirmware = await isProductFirmware({
			sources, productVersionMacroName: versionMacroName
		});
		if (!productFirmware) {
			throw new Error('Auto-versioning is enabled, but the firmware does not appear to be a product firmware. The version macro could not be found. Please disable auto-versioning or specify the correct macro name.');
		}
		info('Auto-versioning is enabled, checking if firmware version should be incremented');
		autoVersionFile = await findProductVersionMacroFile(sources, versionMacroName);
		autoVersionNext = await currentFirmwareVersion(gitRepo, autoVersionFile, versionMacroName);

		const shouldVersion = await shouldIncrementVersion({
			gitRepo, sources, productVersionMacroName: versionMacroName
		});
		if (shouldVersion) {
			const out = await incrementVersion({
				gitRepo,
				sources,
				productVersionMacroName: versionMacroName
			});
			autoVersionNext = out.version;
			autoVersionFile = out.file;
			incremented = true;
		}
	}
	return { autoVersionFile, autoVersionNext, incremented };
}

interface CompileParams {
	auth: string;
	platform: string;
	sources: string;
	targetVersion: string;
}

interface CompileResult {
	outputPath: string | undefined;
}

export async function compile(
	{ auth, platform, sources, targetVersion }: CompileParams
): Promise<CompileResult> {
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
	return { outputPath };
}

export async function compileAction(): Promise<void> {
	try {
		const { auth, platform, sources, autoVersionEnabled, versionMacroName, targetVersion } = await resolveInputs();

		const gitRepo = await findNearestGitRoot(sources);
		const { autoVersionNext } = await autoVersion({
			sources, gitRepo, autoVersionEnabled, versionMacroName
		});

		const { outputPath } = await compile(
			{ auth, platform, sources, targetVersion }
		);

		if (outputPath) {
			setOutput('artifact-path', outputPath);
			setOutput('device-os-version', targetVersion);
			setOutput('firmware-version', autoVersionNext);
		} else {
			setFailed(`Failed to compile code in '${sources}'`);
		}
	} catch (error) {
		if (error instanceof Error) {
			setFailed(error.message);
		}
	}
}
