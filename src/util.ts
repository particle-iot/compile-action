import { _handleMultiFileArgs, populateFileMapping } from './cli';
import { existsSync, renameSync } from 'fs';
// @ts-ignore
import deviceConstants from '@particle/device-constants';
import * as httpm from '@actions/http-client';
import { maxSatisfying, major, prerelease } from 'semver';
import { dirname, join } from 'path';

export function getCode(path: string) {
	if (!existsSync(path)) {
		throw new Error(`Source code ${path} does not exist`);
	}
	const fileMapping = _handleMultiFileArgs([path]);
	// @ts-ignore
	if (!Object.keys(fileMapping.map).length) {
		throw new Error(`There are no valid source code files included in ${path}`);
	}
	populateFileMapping(fileMapping);
	// @ts-ignore
	return fileMapping.map;
}

export function getPlatformId(platform: string) {
	const publicPlatforms = Object.values(deviceConstants).filter((p: any) => p.public);
	const publicPlatformStr = publicPlatforms.map((p: any) => p.name).join(', ');
	if (!platform) {
		throw new Error(`Platform is required. Valid platforms are: ${publicPlatformStr}`);
	}
	const p = deviceConstants[platform];
	if (!p || !p.public) {
		throw new Error(`Platform '${platform}' is not valid. Valid platforms are: ${publicPlatformStr}`);
	}
	return p.id;
}

export function validatePlatformName(platform: string): boolean {
	return Number.isInteger(getPlatformId(platform));
}

export async function validatePlatformDeviceOsTarget(platform: string, requestedVersion: string): Promise<boolean> {
	const { targets } = await fetchBuildTargets();

	const target = targets.find((t) => t.version === requestedVersion);
	if (!target) {
		throw new Error(`Device OS version '${requestedVersion}' does not exist`);
	}
	if (!isSupportedPlatform(target, platform)) {
		throw new Error(`Device OS version '${requestedVersion}' does not support platform '${platform}'`);
	}
	return true;
}

export interface BuildTargetV1 {
	firmware_vendor: string;
	platforms: number[];
	prereleases: number[];
	version: string;
}

export interface BuildTargetsResponseV1 {
	targets: BuildTargetV1[];
	platforms: { [key: string]: number }; // platform name -> platform id
	default_versions: { [key: number]: string }; // platform id -> default version
}

let buildTargets: BuildTargetsResponseV1;

export async function fetchBuildTargets(): Promise<BuildTargetsResponseV1> {
	if (buildTargets) {
		return buildTargets;
	}
	const client = new httpm.HttpClient('particle-compile-action');
	const res: httpm.HttpClientResponse = await client.get(
		'https://api.particle.io/v1/build_targets'
	);
	if (res.message.statusCode !== 200) {
		throw new Error(`Error fetching build targets: ${res.message.statusCode}`);
	}
	const body = JSON.parse(await res.readBody()) as BuildTargetsResponseV1;
	buildTargets = body;
	return buildTargets;
}

export async function resolveVersion(platform: string, requestedVersion: string): Promise<string> {
	if (!requestedVersion) {
		throw new Error(`Device OS version is required`);
	}

	const { targets, default_versions: defaultVersions } = await fetchBuildTargets();
	const versions = targets
		.filter((t: BuildTargetV1) => isSupportedPlatform(t, platform))
		.filter((t: BuildTargetV1) => prerelease(t.version) === null)
		.map((t: BuildTargetV1) => t.version)
		.sort();
	const latest = versions[versions.length - 1];

	if (requestedVersion === 'default') {
		return defaultVersions[getPlatformId(platform)];
	}

	if (requestedVersion === 'latest') {
		return latest;
	}

	if (requestedVersion === 'latest-lts') {
		// find latest lts version that supports this platform
		const ltsVersions = versions.filter((version) => major(version) % 2 === 0 && major(version) >= 2).sort();
		const ltsVersion = ltsVersions.pop();
		if (!ltsVersion) {
			throw new Error(`No latest-lts build target found. The latest Device OS version for '${platform}' is '${latest}'`);
		}
		return ltsVersion;
	}

	// find the latest version that satisfies the version range
	const maxVersion = maxSatisfying(versions, requestedVersion);
	if (!maxVersion) {
		throw new Error(`No Device OS version satisfies '${requestedVersion}'. The latest Device OS version for '${platform}' is '${latest}'`);
	}
	return maxVersion;
}

export function isSupportedPlatform(target: BuildTargetV1, platform: string): boolean {
	const platformId = getPlatformId(platform);
	return target.platforms.includes(platformId);
}

export function renameFile({ filePath, platform, version }: {
	filePath: string,
	platform: string,
	version: string
}): string {
	const dir = dirname(filePath);
	const newFileName = `firmware-${platform}-${version}.bin`;
	const newFilePath = join(dir, newFileName);

	renameSync(filePath, newFilePath);

	return newFilePath;
}

// For testing
export function _resetBuildTargets() {
	// @ts-ignore
	buildTargets = undefined;
}
