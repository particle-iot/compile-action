const findProductVersionMacroFileMock = jest.fn();
const revisionOfLastVersionBumpMock = jest.fn();
const currentFirmwareVersionMock = jest.fn();
const mostRecentRevisionInFolderMock = jest.fn();

jest.mock('./git', () => ({
	findProductVersionMacroFile: findProductVersionMacroFileMock,
	revisionOfLastVersionBump: revisionOfLastVersionBumpMock,
	currentFirmwareVersion: currentFirmwareVersionMock,
	mostRecentRevisionInFolder: mostRecentRevisionInFolderMock
}));

const readFileMock = jest.fn();
const writeFileMock = jest.fn();
jest.mock('fs/promises', () => ({
	readFile: readFileMock,
	writeFile: writeFileMock
}));

const warningMock = jest.fn();
const infoMock = jest.fn();
const debugMock = jest.fn();
const errorMock = jest.fn();
jest.mock('@actions/core', () => ({
	warning: warningMock,
	info: infoMock,
	debug: debugMock,
	error: errorMock
}));

import { findProductVersionMacroFile, currentFirmwareVersion } from './git';
import { readFile, writeFile } from 'fs/promises';
import { isProductFirmware, incrementVersion } from './autoversion';

describe('shouldIncrementVersion', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('should return true if version increment is needed', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/version/file';

		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);
		revisionOfLastVersionBumpMock.mockResolvedValue('abcdef');
		currentFirmwareVersionMock.mockResolvedValue(1);
		mostRecentRevisionInFolderMock.mockResolvedValue('123456');

		const { shouldIncrementVersion } = await import('./autoversion');
		const result = await shouldIncrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		});
		expect(result).toBe(true);
	});

	test('should return false if version increment is not needed', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/version/file';

		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);
		revisionOfLastVersionBumpMock.mockResolvedValue('abcdef');
		currentFirmwareVersionMock.mockResolvedValue(1);
		mostRecentRevisionInFolderMock.mockResolvedValue('abcdef');

		const { shouldIncrementVersion } = await import('./autoversion');
		const result = await shouldIncrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		});
		expect(result).toBe(false);
	});

	test('should throw an error if version macro file is not found', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';

		findProductVersionMacroFileMock.mockResolvedValue(null);

		const { shouldIncrementVersion } = await import('./autoversion');
		await expect(shouldIncrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		})).rejects.toThrow(
			'Could not find a file containing the version macro.'
		);
	});

	test('should throw an error if the last version increment is not found', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/version/file';

		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);
		revisionOfLastVersionBumpMock.mockResolvedValue(null);

		const { shouldIncrementVersion } = await import('./autoversion');
		await expect(shouldIncrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		})).rejects.toThrow(
			'Could not find the last version increment.'
		);
	});

	test('should warn when the product version macro file has uncommitted changes', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/repo/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/repo/sources/version/file';

		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);
		revisionOfLastVersionBumpMock.mockResolvedValue('00000000');

		const { shouldIncrementVersion } = await import('./autoversion');
		await shouldIncrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		});

		expect(warningMock).toHaveBeenCalledWith('The file with the product version macro has uncommitted changes.');
	});

});

describe('incrementVersion', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('should increment the version correctly', async () => {
		const gitRepo = '/path/to/repo';
		const sources = '/path/to/repo/src';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/repo/src/file';
		const currentVersion = 1;
		const nextVersion = currentVersion + 1;
		const fileContent = `${productVersionMacroName}(${currentVersion})`;

		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);
		currentFirmwareVersionMock.mockResolvedValue(currentVersion);
		readFileMock.mockResolvedValue(fileContent);

		const result = await incrementVersion({
			gitRepo,
			sources,
			productVersionMacroName
		});

		expect(findProductVersionMacroFile).toHaveBeenCalledWith({ sources, productVersionMacroName });
		expect(currentFirmwareVersion).toHaveBeenCalledWith({
			gitRepo,
			versionFilePath,
			productVersionMacroName
		});
		expect(readFile).toHaveBeenCalledWith(versionFilePath, 'utf-8');

		const updatedFileContent = `${productVersionMacroName}(${nextVersion})`;
		expect(writeFile).toHaveBeenCalledWith(versionFilePath, updatedFileContent);
		expect(result).toEqual({
			file: versionFilePath,
			version: nextVersion
		});
	});
});

describe('isProductFirmware', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('should return true if product firmware is detected', async () => {
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';
		const versionFilePath = '/path/to/version/file';

		// Set up the mock to return a version file path
		findProductVersionMacroFileMock.mockResolvedValue(versionFilePath);

		const result = await isProductFirmware({
			sources,
			productVersionMacroName
		});

		expect(findProductVersionMacroFile).toHaveBeenCalledWith({ sources, productVersionMacroName });
		expect(result).toBe(true);
	});

	test('should return false if product firmware is not detected', async () => {
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';

		// Set up the mock to return null (no version macro file found)
		findProductVersionMacroFileMock.mockResolvedValue(null);

		const result = await isProductFirmware({
			sources,
			productVersionMacroName
		});

		expect(findProductVersionMacroFile).toHaveBeenCalledWith({ sources, productVersionMacroName });
		expect(result).toBe(false);
	});

	test('should return false if an error occurs', async () => {
		const sources = '/path/to/sources';
		const productVersionMacroName = 'PRODUCT_VERSION';

		// Set up the mock to throw an error
		findProductVersionMacroFileMock.mockRejectedValue(new Error('An error occurred'));

		const result = await isProductFirmware({
			sources,
			productVersionMacroName
		});

		expect(findProductVersionMacroFile).toHaveBeenCalledWith({ sources, productVersionMacroName });
		expect(result).toBe(false);
	});
});
