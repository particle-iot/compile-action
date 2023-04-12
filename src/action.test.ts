jest.mock('./util');

const dockerCheckMock = jest.fn();
const dockerBuildpackCompileMock = jest.fn();
jest.mock('./docker', () => ({
	dockerCheck: dockerCheckMock,
	dockerBuildpackCompile: dockerBuildpackCompileMock
}));

const particleCloudCompileMock = jest.fn();
const particleDownloadBinaryMock = jest.fn();
jest.mock('./particle-api', () => ({
	particleCloudCompile: particleCloudCompileMock,
	particleDownloadBinary: particleDownloadBinaryMock
}));

const getInputMock = jest.fn();
const setFailedMock = jest.fn();
const infoMock = jest.fn();
const setOutputMock = jest.fn();
jest.mock('@actions/core', () => ({
	getInput: getInputMock,
	setFailed: setFailedMock,
	info: infoMock,
	setOutput: setOutputMock
}));

const findProductVersionMacroFileMock = jest.fn();
const currentFirmwareVersionMock = jest.fn();
const findNearestGitRootMock = jest.fn();
const hasFullHistoryMock = jest.fn();
jest.mock('./git', () => {
	return {
		findProductVersionMacroFile: findProductVersionMacroFileMock,
		currentFirmwareVersion: currentFirmwareVersionMock,
		findNearestGitRoot: findNearestGitRootMock,
		hasFullHistory: hasFullHistoryMock
	};
});

const isProductFirmwareMock = jest.fn();
const shouldIncrementVersionMock = jest.fn();
const incrementVersionMock = jest.fn();
jest.mock('./versioning', () => {
	return {
		isProductFirmware: isProductFirmwareMock,
		shouldIncrementVersion: shouldIncrementVersionMock,
		incrementVersion: incrementVersionMock
	};
});

import { compileAction } from './action';

describe('compileAction', () => {

	beforeEach(() => {
		jest.resetModules();
	});

	it('should use compile locally with docker by default', async () => {
		await compileAction();

		expect(dockerCheckMock).toHaveBeenCalled();
		expect(dockerBuildpackCompileMock).toHaveBeenCalled();
	});

	it('should use compile in the cloud if access token is provided', async () => {
		// mock particle-access-token input
		getInputMock.mockImplementation((name: string) => {
			if (name === 'particle-access-token') {
				return 'test-token';
			}
			return '';
		});
		particleCloudCompileMock.mockResolvedValue('test-binary-id');
		particleDownloadBinaryMock.mockResolvedValue('test-path');

		await compileAction();

		expect(particleCloudCompileMock).toHaveBeenCalled();
		expect(particleDownloadBinaryMock).toHaveBeenCalled();
	});

	it('should throw an error if cloud compilation fails', async () => {
		// mock particle-access-token input
		getInputMock.mockImplementation((name: string) => {
			if (name === 'particle-access-token') {
				return 'test-token';
			}
			return '';
		});
		particleCloudCompileMock.mockResolvedValue(null);

		await compileAction();

		expect(setFailedMock).toHaveBeenCalled();
		expect(setFailedMock).toHaveBeenCalledWith('Failed to compile code in cloud');
	});
});

describe('autoVersion', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	test('should throw an error if auto-versioning is enabled and firmware is not a product firmware', async () => {
		const params = {
			sources: '/path/to/repo/src',
			gitRepo: '/path/to/repo',
			autoVersionEnabled: true,
			versionMacroName: 'PRODUCT_VERSION'
		};
		const { autoVersion } = await import('./action');

		hasFullHistoryMock.mockResolvedValue(true);
		isProductFirmwareMock.mockResolvedValue(false);

		await expect(autoVersion(params)).rejects.toThrow(
			'Auto-versioning is enabled, but the firmware does not appear to be a product firmware.'
		);
	});

	test('should increment the firmware version if auto-versioning is enabled and shouldIncrementVersion returns true', async () => {
		const params = {
			sources: '/path/to/repo/src',
			gitRepo: '/path/to/repo',
			autoVersionEnabled: true,
			versionMacroName: 'PRODUCT_VERSION'
		};
		const { autoVersion } = await import('./action');

		hasFullHistoryMock.mockResolvedValue(true);
		isProductFirmwareMock.mockResolvedValue(true);
		findProductVersionMacroFileMock.mockResolvedValue('/path/to/repo/src/application.cpp');
		currentFirmwareVersionMock.mockResolvedValue(1);
		shouldIncrementVersionMock.mockResolvedValue(true);
		incrementVersionMock.mockResolvedValue({
			file: '/path/to/repo/src/application.cpp',
			version: 2
		});

		const result = await autoVersion(params);

		expect(isProductFirmwareMock).toHaveBeenCalled();
		expect(findProductVersionMacroFileMock).toHaveBeenCalled();
		expect(currentFirmwareVersionMock).toHaveBeenCalled();
		expect(shouldIncrementVersionMock).toHaveBeenCalled();
		expect(result).toEqual({
			versionFile: '/path/to/repo/src/application.cpp',
			version: 2,
			incremented: true
		});
	});

	test('should not increment the firmware version if auto-versioning is enabled and shouldIncrementVersion returns false', async () => {
		const params = {
			sources: '/path/to/repo/src',
			gitRepo: '/path/to/repo',
			autoVersionEnabled: true,
			versionMacroName: 'PRODUCT_VERSION'
		};
		const { autoVersion } = await import('./action');

		hasFullHistoryMock.mockResolvedValue(true);
		isProductFirmwareMock.mockResolvedValue(true);
		findProductVersionMacroFileMock.mockResolvedValue('/path/to/repo/src/application.cpp');
		currentFirmwareVersionMock.mockResolvedValue(1);
		shouldIncrementVersionMock.mockResolvedValue(false);

		const result = await autoVersion(params);

		expect(isProductFirmwareMock).toHaveBeenCalled();
		expect(findProductVersionMacroFileMock).toHaveBeenCalled();
		expect(currentFirmwareVersionMock).toHaveBeenCalled();
		expect(shouldIncrementVersionMock).toHaveBeenCalled();
		expect(result).toEqual({
			versionFile: '/path/to/repo/src/application.cpp',
			version: 1,
			incremented: false
		});
	});

	test('should check firmware version if auto-versioning is disabled', async () => {
		const params = {
			sources: '/path/to/sources',
			gitRepo: '/path/to/repo',
			autoVersionEnabled: false,
			versionMacroName: 'PRODUCT_VERSION'
		};
		const { autoVersion } = await import('./action');

		currentFirmwareVersionMock.mockResolvedValue(1);

		const result = await autoVersion(params);

		hasFullHistoryMock.mockResolvedValue(true);
		expect(isProductFirmwareMock).not.toHaveBeenCalled();
		expect(findProductVersionMacroFileMock).toHaveBeenCalled();
		expect(currentFirmwareVersionMock).toHaveBeenCalled();
		expect(shouldIncrementVersionMock).not.toHaveBeenCalled();
		expect(result).toEqual({
			versionFile: undefined,
			version: 1,
			incremented: false
		});
	});
});
