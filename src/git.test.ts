import { readdir, readFile, stat } from 'fs/promises';
import { Dirent } from 'fs';
import {
	currentFirmwareVersion, findNearestGitRoot,
	findProductVersionMacroFile, hasFullHistory, mostRecentRevisionInFolder,
	revisionOfLastVersionBump
} from './git';

jest.mock('simple-git');
import simpleGit, { SimpleGit } from 'simple-git';

const gitMock = simpleGit as jest.MockedFunction<typeof simpleGit>;

jest.mock('fs/promises');
const readdirMock = readdir as jest.MockedFunction<typeof readdir>;
const statMock = stat as jest.MockedFunction<typeof stat>;
const readFileMock = readFile as jest.MockedFunction<typeof readFile>;

describe('revisionOfLastVersionBump', () => {
	const rawMock = jest.fn();

	const createBlameInfoMock = (commitHash: string, productVersionMacroName: string) => {
		return `${commitHash} (Author 2023-04-07 12:34:56 +0000 1) ${productVersionMacroName}(5)`;
	};

	beforeEach(() => {
		gitMock.mockReturnValue({ raw: rawMock } as unknown as SimpleGit);
		rawMock.mockReset();
	});

	test('should return git revision from blame info', async () => {
		const commitHash = 'a1b2c3d4e5f6';
		const gitRepo = '/path/to/repo';
		const versionFilePath = '/path/to/version/file/application.cpp';
		const productVersionMacroName = 'PRODUCT_VERSION';

		rawMock.mockResolvedValue(createBlameInfoMock(commitHash, productVersionMacroName));

		const result = await revisionOfLastVersionBump({
			gitRepo: gitRepo,
			versionFilePath: versionFilePath,
			productVersionMacroName: productVersionMacroName
		});

		expect(result).toEqual(commitHash);
		expect(gitMock).toHaveBeenCalledWith(gitRepo);
		expect(rawMock).toHaveBeenCalledWith(['blame', versionFilePath]);
	});

	test('should throw error if product version macro name is not found', async () => {
		const gitRepo = '/path/to/repo';
		const versionFilePath = '/path/to/version/file/application.cpp';
		const productVersionMacroName = 'PRODUCT_VERSION';

		rawMock.mockResolvedValue(`Different line content`);

		await expect(revisionOfLastVersionBump({
			gitRepo: gitRepo,
			versionFilePath: versionFilePath,
			productVersionMacroName: productVersionMacroName
		})).rejects.toThrow(
			`Could not find the ${productVersionMacroName} line in the blame information.`
		);
	});
});

describe('currentFirmwareVersion', () => {
	const logMock = jest.fn();
	const showMock = jest.fn();

	const createCommitBodyMock = (productVersionMacroName: string, version: number) => {
		return `${productVersionMacroName}(${version})`;
	};

	const createLogMock = (hashes: string[]) => {
		return {
			all: hashes.map(hash => ({ hash })),
			total: hashes.length
		};
	};

	beforeEach(() => {
		gitMock.mockReturnValue({ log: logMock, show: showMock } as unknown as SimpleGit);
		logMock.mockReset();
		showMock.mockReset();
	});

	test('should return highest firmware version', async () => {
		const commitHashes = ['a1b2c3d4e5f6', 'b2c3d4e5f6a1'];
		const gitRepo = '/path/to/repo';
		const versionFilePath = '/path/to/repo/project-folder/application.cpp';
		const productVersionMacroName = 'PRODUCT_VERSION';

		logMock.mockResolvedValue(createLogMock(commitHashes));
		showMock
			.mockResolvedValueOnce(createCommitBodyMock(productVersionMacroName, 2))
			.mockResolvedValueOnce(createCommitBodyMock(productVersionMacroName, 1));

		const result = await currentFirmwareVersion({
			gitRepo: gitRepo,
			versionFilePath: versionFilePath,
			productVersionMacroName: productVersionMacroName
		});

		expect(result).toBe(2);
		expect(gitMock).toHaveBeenCalledWith(gitRepo);
		expect(logMock).toHaveBeenCalledWith({
			'-p': null,
			'--': null,
			file: versionFilePath
		});
		expect(showMock).toHaveBeenCalledTimes(2);
		expect(showMock).toHaveBeenNthCalledWith(1, [`${commitHashes[0]}:project-folder/application.cpp`]);
		expect(showMock).toHaveBeenNthCalledWith(2, [`${commitHashes[1]}:project-folder/application.cpp`]);
	});

	test('should return 0 if no version matches are found', async () => {
		const commitHashes = ['a1b2c3d4e5f6', 'b2c3d4e5f6a1'];
		const gitRepo = '/path/to/repo';
		const versionFilePath = '/path/to/version/file/application.cpp';
		const productVersionMacroName = 'PRODUCT_VERSION';

		logMock.mockResolvedValue(createLogMock(commitHashes));
		showMock.mockResolvedValue(`Unrelated content`);

		const result = await currentFirmwareVersion({
			gitRepo: gitRepo,
			versionFilePath: versionFilePath,
			productVersionMacroName: productVersionMacroName
		});

		expect(result).toBe(0);
	});
});

describe('findProductVersionMacroFile', () => {
	beforeEach(() => {
		readdirMock.mockReset();
		statMock.mockReset();
		readFileMock.mockReset();
	});

	test('should find the version macro file', async () => {
		const gitRepo = '/path/to/repo';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/repo/src/application.cpp';
		const fileContent = `${productVersionMacroName}(1)`;

		readdirMock
			.mockResolvedValueOnce([
				'.git',
				'.gitignore',
				'project.properties',
				'readme.md',
				'src' // mock directory
			] as unknown as Dirent[])
			.mockResolvedValueOnce([
				'application.h',
				'application.cpp',
				'util.cpp'
			] as unknown as Dirent[]);
		// @ts-ignore
		statMock.mockImplementation((file) => {
			if (file === '/path/to/repo/src' || file === '/path/to/repo/.git') {
				return Promise.resolve({ isDirectory: () => true });
			}
			return Promise.resolve({ isDirectory: () => false });
		});
		// @ts-ignore
		readFileMock.mockImplementation((file) => {
			return file === versionFilePath ? Promise.resolve(fileContent) : Promise.resolve(`Different content`);
		});

		const result = await findProductVersionMacroFile({
			sources: gitRepo,
			productVersionMacroName: productVersionMacroName
		});
		expect(readdirMock).toHaveBeenCalledTimes(2);
		expect(statMock).toHaveBeenCalledTimes(7);
		expect(readFileMock).toHaveBeenCalledTimes(5);
		expect(result).toBe(versionFilePath);
	});

	test('should throw an error if the version macro file is not found', async () => {
		const sources = '/path/to/repo/src';
		const productVersionMacroName = 'PRODUCT_VERSION';

		readdirMock.mockResolvedValue([
			'file1',
			'file2',
			'file3'
		] as unknown as Dirent[]);
		// @ts-ignore
		statMock.mockResolvedValue({ isDirectory: () => false });
		readFileMock.mockResolvedValue(`Different content`);

		await expect(findProductVersionMacroFile({
			sources: sources, productVersionMacroName: productVersionMacroName
		})).rejects.toThrow(
			`Could not find a file containing the ${productVersionMacroName} macro.`
		);
	});
});

describe('findNearestGitRoot', () => {
	const revparseMock = jest.fn();

	beforeEach(() => {
		gitMock.mockReturnValue({
			revparse: revparseMock
		} as unknown as SimpleGit);
		jest.clearAllMocks();
	});

	test('should return the nearest Git root', async () => {
		const startingPath = '/path/to/repo/some/subdirectory';
		const gitRoot = '/path/to/repo';

		// Set up the mock to return the Git root
		revparseMock.mockResolvedValue(`${gitRoot}\n`);

		const result = await findNearestGitRoot({ startingPath: startingPath });

		expect(revparseMock).toHaveBeenCalledWith(['--show-toplevel']);
		expect(result).toBe(gitRoot);
	});

	test('should search for Git root in parent directories', async () => {
		const startingPath = '/path/to/repo/some/subdirectory';
		const gitRoot = '/path/to/repo';

		// Set up the mock to throw an error for the starting path and return the Git root for the parent path
		revparseMock
			.mockRejectedValueOnce(new Error('Not a Git repository'))
			.mockResolvedValueOnce(`${gitRoot}\n`);

		const result = await findNearestGitRoot({ startingPath: startingPath });

		expect(revparseMock).toHaveBeenCalledTimes(2);
		expect(result).toBe(gitRoot);
	});

	test('should throw an error if no Git repository is found in the parent directories', async () => {
		const startingPath = '/path/to/non-git-folder';

		// Set up the mock to throw an error
		revparseMock.mockRejectedValue(new Error('Not a Git repository'));

		await expect(findNearestGitRoot({ startingPath: startingPath })).rejects.toThrow(
			'No Git repository found in the parent directories'
		);
	});
});

describe('mostRecentRevisionInFolder', () => {
	const logMock = jest.fn();

	beforeEach(() => {
		gitMock.mockReturnValue({
			log: logMock
		} as unknown as SimpleGit);
		jest.clearAllMocks();
	});

	test('should return the latest Git revision for a folder', async () => {
		const gitRepo = '/path/to/repo';
		const folderPath = '/path/to/repo/some/folder';
		const latestHash = '123456789abcdef';

		// Set up the mock to return the latest Git revision
		logMock.mockResolvedValue({
			latest: {
				hash: latestHash
			}
		});

		const result = await mostRecentRevisionInFolder({ gitRepo: gitRepo, folderPath: folderPath });

		expect(logMock).toHaveBeenCalledWith({ file: folderPath });
		expect(result).toBe(latestHash.substring(0, 8));
	});

	test('should throw an error if no latest revision is found', async () => {
		const gitRepo = '/path/to/repo';
		const folderPath = '/path/to/repo/some/folder';

		// Set up the mock to return an empty log object
		logMock.mockResolvedValue({});

		await expect(mostRecentRevisionInFolder({ gitRepo: gitRepo, folderPath: folderPath })).rejects.toThrow(
			'Error getting the latest Git revision for folder'
		);
	});

	test('should throw an error if there is an error retrieving the Git log', async () => {
		const gitRepo = '/path/to/repo';
		const folderPath = '/path/to/repo/some/folder';

		// Set up the mock to throw an error
		logMock.mockRejectedValue(new Error('Error retrieving Git log'));

		await expect(mostRecentRevisionInFolder({ gitRepo: gitRepo, folderPath: folderPath })).rejects.toThrow(
			'Error getting the latest Git revision for folder'
		);
	});

});
describe('hasFullHistory', () => {
	const gitRepo = '.'; // Use the current directory as the git repository for testing

	it('should return true if the local repository has full history', async () => {
		gitMock.mockReturnValue({
			raw: jest.fn().mockResolvedValue('false')
		} as unknown as SimpleGit);

		const result = await hasFullHistory({ gitRepo: gitRepo });
		expect(result).toBe(true);
	});

	it('should return false if the local repository does not have full history', async () => {
		gitMock.mockReturnValue({
			raw: jest.fn().mockResolvedValue('true')
		} as unknown as SimpleGit);

		const result = await hasFullHistory({ gitRepo: gitRepo });
		expect(result).toBe(false);
	});

});
