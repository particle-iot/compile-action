import { readFile, writeFile } from 'fs/promises';
import { info, warning, debug, error } from '@actions/core';
import simpleGit, { SimpleGit } from 'simple-git';
import {
	currentFirmwareVersion,
	findProductVersionMacroFile,
	mostRecentRevisionInFolder,
	revisionOfLastVersionBump
} from './git';

const git: SimpleGit = simpleGit();

// Detailed Git repo state logging functions, for debugging git state in the Action runner
async function logGitStatus(gitRepo: string): Promise<void> {
	try {
		const status = await git.cwd(gitRepo).status();
		debug(`Git Status: ${JSON.stringify(status)}`);
	} catch (e) {
		error(`Error getting Git status: ${e}`);
	}
}

async function logGitBranches(gitRepo: string): Promise<void> {
	try {
		const branches = await git.cwd(gitRepo).branchLocal();
		debug(`Local branches: ${JSON.stringify(branches)}`);
	} catch (e) {
		error(`Error listing branches: ${e}`);
	}
}

async function logGitCommitHistory(gitRepo: string, filePath: string): Promise<void> {
	try {
		const log = await git.cwd(gitRepo).log({ file: filePath });
		debug(`Git log for ${filePath}: ${JSON.stringify(log)}`);
	} catch (e) {
		error(`Error getting Git log for file ${filePath}: ${e}`);
	}
}

async function getChangedFilesBetweenCommits(gitRepo: string, commit1: string, commit2: string): Promise<string[]> {
	try {
		const diffSummary = await git.cwd(gitRepo).diffSummary([commit1, commit2]);
		return diffSummary.files.map(file => file.file);
	} catch (e) {
		error(`Error getting changed files between commits ${commit1} and ${commit2}: ${e}`);
		return [];
	}
}

export async function shouldIncrementVersion(
	{ gitRepo, sources, productVersionMacroName }: {
		gitRepo: string;
		sources: string;
		productVersionMacroName: string;
	}
): Promise<boolean> {
	debug(`Starting shouldIncrementVersion for productVersionMacroName: ${productVersionMacroName} in repo: ${gitRepo}`);

	// Additional debugging around Git repo state at the start
	await logGitStatus(gitRepo);
	await logGitBranches(gitRepo);

	const versionFilePath = await findProductVersionMacroFile({
		sources,
		productVersionMacroName
	});
	if (!versionFilePath) {
		throw new Error('Could not find a file containing the version macro.');
	}

	await logGitCommitHistory(gitRepo, versionFilePath);

	const lastChangeRevision = await revisionOfLastVersionBump({
		gitRepo: gitRepo,
		versionFilePath: versionFilePath,
		productVersionMacroName: productVersionMacroName
	});
	debug(`Last change revision: ${lastChangeRevision}`);

	const currentSourcesRevision = await mostRecentRevisionInFolder({ gitRepo: gitRepo, folderPath: sources });
	debug(`Current sources revision: ${currentSourcesRevision}`);

	// Additional debugging around changed files
	if (lastChangeRevision !== currentSourcesRevision) {
		const changedFiles = await getChangedFilesBetweenCommits(gitRepo, lastChangeRevision, currentSourcesRevision);
		debug(`Files changed between ${lastChangeRevision} and ${currentSourcesRevision}: ${JSON.stringify(changedFiles)}`);
	}

	const currentProductVersion = await currentFirmwareVersion({
		gitRepo: gitRepo,
		versionFilePath: versionFilePath,
		productVersionMacroName: productVersionMacroName
	});
	debug(`Current product version: ${currentProductVersion}`);

	if (!lastChangeRevision) {
		throw new Error('Could not find the last version increment.');
	}

	info(`Current firmware version: ${currentProductVersion} (${currentSourcesRevision})`);
	info(`Firmware version last set at: ${lastChangeRevision}`);

	if (lastChangeRevision === '00000000') {
		warning('The file with the product version macro has uncommitted changes.');
	}

	const shouldIncrement = currentSourcesRevision !== lastChangeRevision;
	debug(`Should increment version: ${shouldIncrement}`);

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
	debug(`Starting incrementVersion for productVersionMacroName: ${productVersionMacroName} in repo: ${gitRepo}`);

	const versionFilePath = await findProductVersionMacroFile({
		sources,
		productVersionMacroName
	});

	debug(`Version file path for incrementing: ${versionFilePath}`);

	const current = await currentFirmwareVersion({
		gitRepo: gitRepo,
		versionFilePath: versionFilePath,
		productVersionMacroName: productVersionMacroName
	});

	debug(`Current version before increment: ${current}`);
	const next = current + 1;

	const versionRegex = new RegExp(`^.*${productVersionMacroName}.*\\((\\d+)\\)`, 'gm');

	const fileContent = await readFile(versionFilePath, 'utf-8');
	debug(`Read version file content from: ${versionFilePath}`);

	const updatedFileContent = fileContent.replace(versionRegex, (match, p1) => {
		info(`Replacing ${p1} with ${next} in ${versionFilePath}`);
		debug(`Match found for version increment: ${match}`);
		return match.replace(p1, next.toString());
	});

	await writeFile(versionFilePath, updatedFileContent);
	debug(`Version file updated: ${versionFilePath}`);

	// Additional debugging around Git repo state at the end
	// A successful version increment should leave a modified file in the repo
	// Users should commit and push the updated version file to git after `compile-action` finishes
	await logGitStatus(gitRepo);

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
	debug(`Checking if product firmware for productVersionMacroName: ${productVersionMacroName}`);

	let isProductFirmware = false;
	try {
		isProductFirmware = !!await findProductVersionMacroFile({
			sources: sources,
			productVersionMacroName: productVersionMacroName
		});
		debug(`Product firmware status: ${isProductFirmware}`);
	} catch (err) {
		debug(`Error in isProductFirmware: ${err}`);
		// Ignore
	}
	return isProductFirmware;
}
