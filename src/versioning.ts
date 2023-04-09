// Auto revision assumes the PRODUCT_VERSION macro is only incremented and not decremented.

import { readFile, writeFile } from 'fs/promises';
import { info, warning } from '@actions/core';
import {
	currentFirmwareVersion,
	findProductVersionMacroFile,
	mostRecentRevisionInFolder,
	revisionOfLastVersionBump
} from './git';

export async function shouldIncrementVersion(
	{ gitRepo, sources, productVersionMacroName }: {
		gitRepo: string;
		sources: string;
		productVersionMacroName: string;
	}
): Promise<boolean> {
	const versionFilePath = await findProductVersionMacroFile({
		sources,
		productVersionMacroName
	});
	if (!versionFilePath) {
		throw new Error('Could not find a file containing the version macro.');
	}

	const lastChangeRevision = await revisionOfLastVersionBump({
		gitRepo: gitRepo,
		versionFilePath: versionFilePath,
		productVersionMacroName: productVersionMacroName
	});
	const currentSourcesRevision = await mostRecentRevisionInFolder({ gitRepo: gitRepo, folderPath: sources });
	const currentProductVersion = await currentFirmwareVersion({
		gitRepo: gitRepo,
		versionFilePath: versionFilePath,
		productVersionMacroName: productVersionMacroName
	});

	if (!lastChangeRevision) {
		throw new Error('Could not find the last version increment.');
	}

	info(`Current firmware version: ${currentProductVersion} (${currentSourcesRevision})`);
	info(`Firmware version last set at: ${lastChangeRevision}`);
	if (lastChangeRevision === '00000000') {
		warning('The file with the product version macro has uncommitted changes.');
	}

	const shouldIncrement = currentSourcesRevision !== lastChangeRevision;
	if (!shouldIncrement) {
		info('No version increment detected. Skipping version increment.');
		return false;
	}
	info(`Incrementing firmware version to ${currentProductVersion + 1}.`);
	return true;
}

export async function incrementVersion(
	{ gitRepo, sources, productVersionMacroName }: {
		gitRepo: string;
		sources: string;
		productVersionMacroName: string;
	}): Promise<{
	file: string;
	version: number
}> {
	// find the file containing the version macro
	const versionFilePath = await findProductVersionMacroFile({
		sources: sources,
		productVersionMacroName: productVersionMacroName
	});

	// get the current version
	const current = await currentFirmwareVersion(
		{ gitRepo: gitRepo, versionFilePath: versionFilePath, productVersionMacroName: productVersionMacroName }
	);

	// increment the version
	const next = current + 1;

	// find the line that matches this regex
	const versionRegex = new RegExp(`^.*${productVersionMacroName}.*\\((\\d+)\\)`, 'gm');

	// Read the file content
	const fileContent = await readFile(versionFilePath, 'utf-8');

	// Replace the version with the next version
	const updatedFileContent = fileContent.replace(versionRegex, (match, p1) => {
		info(`Replacing ${p1} with ${next} in ${versionFilePath}`);
		return match.replace(p1, next.toString());
	});

	await writeFile(versionFilePath, updatedFileContent);

	return {
		file: versionFilePath,
		version: next
	};
}


export async function isProductFirmware(
	{ sources, productVersionMacroName }: {
		sources: string;
		productVersionMacroName: string;
	}): Promise<boolean> {
	let isProductFirmware = false;
	try {
		isProductFirmware = !!await findProductVersionMacroFile({
			sources: sources,
			productVersionMacroName: productVersionMacroName
		});
	} catch (error) {
		// Ignore
	}
	return isProductFirmware;
}
