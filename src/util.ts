import { _handleMultiFileArgs, populateFileMapping } from './cli';
import { existsSync } from 'fs';
// @ts-ignore
import deviceConstants from '@particle/device-constants';
import * as httpm from '@actions/http-client';
import { maxSatisfying, major } from 'semver';

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
		throw new Error(`Platform ${platform} is not valid. Valid platforms are: ${publicPlatformStr}`);
	}
	return p.id;
}

export async function validatePlatformFirmware(platform: string, version: string): Promise<boolean> {
	const manifest = await fetchFirmwareManifest();
	const dvos = manifest.binaryDataDeviceOS[version];
	if (!dvos) {
		throw new Error(`Device OS version '${version}' does not exist`);
	}
	if (!dvos[platform]) {
		throw new Error(`Device OS version '${version}' does not support platform '${platform}'`);
	}
	return true;
}

// Incomplete type definition for firmware manifest
export interface FirmwareManifestV1 {
	defaultVersions: { [key: string]: string };
	binaryDataDeviceOS: { [key: string]: { [key: string]: string } };
}

let firmwareManifest: FirmwareManifestV1;

export async function fetchFirmwareManifest(): Promise<FirmwareManifestV1> {
	if (firmwareManifest) {
		return firmwareManifest;
	}
	const client = new httpm.HttpClient('particle-compile-action');
	const res: httpm.HttpClientResponse = await client.get(
		'https://binaries.particle.io/firmware-versions-manifest.json'
	);
	if (res.message.statusCode !== 200) {
		throw new Error(`Error fetching firmware manifest: ${res.message.statusCode}`);
	}
	firmwareManifest = JSON.parse(await res.readBody());
	return firmwareManifest;
}

export async function resolveVersion(platform: string, version: string): Promise<string> {
	if (!version) {
		throw new Error(`Device OS version is required`);
	}

	const manifest = await fetchFirmwareManifest();
	const latest = manifest.defaultVersions[platform];
	if (version === 'latest') {
		return latest;
	}

	if (version === 'latest-lts') {
		// if latest major is even, then it is the latest lts
		if (major(latest) % 2 === 0) {
			return latest;
		}
		// otherwise, find the latest lts
		delete manifest.binaryDataDeviceOS.binaryUrlGithub;
		delete manifest.binaryDataDeviceOS.binaryUrlApi;
		const versions = Object.keys(manifest.binaryDataDeviceOS);
		const ltsVersions = versions.filter((v) => major(v) % 2 === 0);
		const ltsVersion = maxSatisfying(ltsVersions, version);
		if (!ltsVersion) {
			throw new Error(`No latest-lts version found for '${platform}'. The latest supported Device OS version is '${latest}'`);
		}
		return ltsVersion;
	}

	const versions = Object.keys(manifest.binaryDataDeviceOS);
	const maxVersion = maxSatisfying(versions, version);
	if (!maxVersion) {
		throw new Error(`No Device OS version satisfies '${version}'`);
	}
	return maxVersion;
}

// For testing
export function _resetFirmwareManifest() {
	// @ts-ignore
	firmwareManifest = undefined;
}
