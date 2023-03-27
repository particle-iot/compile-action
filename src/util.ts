import { _handleMultiFileArgs, populateFileMapping } from './cli';
import { existsSync } from 'fs';
// @ts-ignore
import deviceConstants from '@particle/device-constants';

export function getCode(path: string) {
	if (!existsSync(path)) {
		throw new Error(`Source code ${path} does not exist`);
	}
	const fileMapping = _handleMultiFileArgs([path]);
	// @ts-ignore
	if (!Object.keys(fileMapping.map).length){
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
