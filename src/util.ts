import { _handleMultiFileArgs, populateFileMapping } from './cli';
import { existsSync } from 'fs';

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
