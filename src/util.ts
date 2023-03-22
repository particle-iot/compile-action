import { _handleMultiFileArgs, populateFileMapping } from './cli';

export function getCode(path: string) {
	const fileMapping = _handleMultiFileArgs([path]);
	populateFileMapping(fileMapping);
	// @ts-ignore
	if (Object.keys(fileMapping.map).length === 0){
		throw new Error(`no files included in ${path}`);
	}
	// @ts-ignore
	return fileMapping.map || fileMapping;
}
