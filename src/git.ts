import { readdir, readFile, stat } from 'fs/promises';
import { dirname, join } from 'path';
import simpleGit, { SimpleGit } from 'simple-git';

export async function currentFirmwareVersion(
	{ gitRepo, versionFilePath, productVersionMacroName }: {
		gitRepo: string,
		versionFilePath: string,
		productVersionMacroName: string
	}
): Promise<number> {
	const git: SimpleGit = simpleGit(gitRepo);

	// Get the commit history with patch details for the version file
	const logs = await git.log({
		'-p': null,
		'--': null,
		file: versionFilePath
	});

	let highestVersion = 0;

	// if versionFilePath starts with sources, remove it
	if (versionFilePath.startsWith(gitRepo)) {
		versionFilePath = versionFilePath.substring(gitRepo.length + 1);
	}

	for (const log of logs.all) {
		const currentCommit = log.hash;
		const commitBody = await git.show([`${currentCommit}:${versionFilePath}`]);

		// Use regex to extract the PRODUCT_VERSION from the patch
		const versionRegex = new RegExp(`^.*${productVersionMacroName}.*\\((\\d+)\\)`, 'gm');

		const match = versionRegex.exec(commitBody);

		if (match) {
			const currentVersion = parseInt(match[1], 10);

			// Check if the current version is higher than the previous version and higher than the highest version found
			if (currentVersion > highestVersion) {
				highestVersion = currentVersion;
			}
		}
	}

	return highestVersion;
}

export async function revisionOfLastVersionBump(
	{ gitRepo, versionFilePath, productVersionMacroName }: {
		gitRepo: string,
		versionFilePath: string,
		productVersionMacroName: string
	}
): Promise<string> {
	const git: SimpleGit = simpleGit(gitRepo);

	// Get the blame information for the version file
	const blameInfo = await git.raw(['blame', versionFilePath]);

	// Use regex to find the line containing the PRODUCT_VERSION macro
	const versionRegex = new RegExp(`^([a-f0-9]+).+${productVersionMacroName}.*\\(\\d+\\)`, 'm');
	const match = versionRegex.exec(blameInfo);

	if (match) {
		const commitHash = match[1];
		return commitHash;
	} else {
		throw new Error(`Could not find the ${productVersionMacroName} line in the blame information.`);
	}
}

export async function findProductVersionMacroFile(
	{ sources, productVersionMacroName }: { sources: string, productVersionMacroName: string }
): Promise<string> {
	const files = await readdir(sources);

	for (const file of files) {
		const fullPath = join(sources, file);
		const fileStat = await stat(fullPath);

		if (fileStat.isDirectory()) {
			if (file.startsWith('.')) {
				continue;
			}
			try {
				return await findProductVersionMacroFile({
					sources: fullPath,
					productVersionMacroName: productVersionMacroName
				});
			} catch (error) {
				// Ignore. It means the file was not found in this directory.
			}
		} else {
			const fileContent = await readFile(fullPath, 'utf-8');
			const versionRegex = new RegExp(`^.*${productVersionMacroName}.*\\((\\d+)\\)`, 'gm');
			if (fileContent && versionRegex.test(fileContent)) {
				return fullPath;
			}
		}
	}

	throw new Error(`Could not find a file containing the ${productVersionMacroName} macro.`);
}

export async function findNearestGitRoot(
	{ startingPath }: { startingPath: string }
): Promise<string> {
	const git: SimpleGit = simpleGit(startingPath);

	try {
		const gitRoot = await git.revparse(['--show-toplevel']);
		return gitRoot.trim();
	} catch (error) {
		const parentPath = dirname(startingPath);

		if (parentPath === startingPath) {
			throw new Error('No Git repository found in the parent directories');
		}

		return await findNearestGitRoot({ startingPath: parentPath });
	}
}

export async function mostRecentRevisionInFolder(
	{ gitRepo, folderPath }: { gitRepo: string, folderPath: string }
): Promise<string> {
	const git: SimpleGit = simpleGit(gitRepo);

	try {
		const log = await git.log({ file: folderPath });
		if (!log.latest) {
			throw new Error('No latest revision found');
		}
		return log.latest.hash.substring(0, 8);
	} catch (error) {
		throw new Error(`Error getting the latest Git revision for folder "${folderPath}": ${error}`);
	}
}
