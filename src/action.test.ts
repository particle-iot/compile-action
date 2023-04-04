import nock from 'nock';

describe('compileAction', () => {

	afterEach(() => {
		jest.resetModules();
	});

	it('should use compile locally with docker by default', async () => {
		const dockerCheckMock = jest.fn();
		const dockerBuildpackCompileMock = jest.fn();
		jest.mock('./docker', () => ({
			dockerCheck: dockerCheckMock,
			dockerBuildpackCompile: dockerBuildpackCompileMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(dockerCheckMock).toHaveBeenCalled();
		expect(dockerBuildpackCompileMock).toHaveBeenCalled();
	});

	it('should use compile in the cloud if access token is provided', async () => {
		// mock particle-access-token input
		jest.mock('@actions/core', () => ({
			getInput: jest.fn().mockImplementation((name: string) => {
				if (name === 'particle-access-token') {
					return 'test-token';
				}
				return '';
			}),
			setFailed: jest.fn(),
			info: jest.fn(),
			setOutput: jest.fn()
		}));

		const particleCloudCompileMock = jest.fn().mockResolvedValue('test-binary-id');
		const particleDownloadBinaryMock = jest.fn().mockResolvedValue('test-path');
		jest.mock('./particle-api', () => ({
			particleCloudCompile: particleCloudCompileMock,
			particleDownloadBinary: particleDownloadBinaryMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(particleCloudCompileMock).toHaveBeenCalled();
		expect(particleDownloadBinaryMock).toHaveBeenCalled();
	});

	it('should throw an error if cloud compilation fails', async () => {
		// mock particle-access-token input
		const setFailedMock = jest.fn();
		jest.mock('@actions/core', () => ({
			getInput: jest.fn().mockImplementation((name: string) => {
				if (name === 'particle-access-token') {
					return 'test-token';
				}
				return '';
			}),
			setFailed: setFailedMock,
			info: jest.fn(),
			setOutput: jest.fn()
		}));

		const particleCloudCompileMock = jest.fn().mockResolvedValue(null);
		jest.mock('./particle-api', () => ({
			particleCloudCompile: particleCloudCompileMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(setFailedMock).toHaveBeenCalled();
		expect(setFailedMock).toHaveBeenCalledWith('Failed to compile code in cloud');
	});

	it('should have the same device-os-version output as input when it is a known version', async () => {
		const setOutputMock = jest.fn();
		const setFailedMock = jest.fn();
		const knownVersion = '2.3.1';
		jest.mock('@actions/core', () => ({
			getInput: jest.fn().mockImplementation((name: string) => {
				if (name === 'particle-platform-name') {
					return 'electron';
				}
				if (name === 'device-os-version') {
					return knownVersion;
				}
				return '';
			}),
			setFailed: setFailedMock,
			info: jest.fn(),
			setOutput: setOutputMock
		}));

		const dockerBuildpackCompileMock = jest.fn().mockResolvedValue('test-path');
		jest.mock('./docker', () => ({
			dockerCheck: jest.fn(),
			dockerBuildpackCompile: dockerBuildpackCompileMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(setOutputMock).toHaveBeenNthCalledWith(1, 'artifact-path', 'test-path');
		expect(setOutputMock).toHaveBeenNthCalledWith(2, 'device-os-version', knownVersion);
		expect(setFailedMock).not.toHaveBeenCalled();
	});

	it('should set the device-os-version output to an actual version when latest is the input', async () => {
		nock('https://binaries.particle.io')
			.get('/firmware-versions-manifest.json')
			.once()
			.replyWithFile(200, `test/fixtures/firmware-manifest-v1/manifest.json`);

		const setOutputMock = jest.fn();
		const setFailedMock = jest.fn();
		jest.mock('@actions/core', () => ({
			getInput: jest.fn().mockImplementation((name: string) => {
				if (name === 'particle-platform-name') {
					return 'argon';
				}
				if (name === 'device-os-version') {
					return 'latest';
				}
				return '';
			}),
			setFailed: setFailedMock,
			info: jest.fn(),
			setOutput: setOutputMock
		}));

		const dockerBuildpackCompileMock = jest.fn().mockResolvedValue('test-path');
		jest.mock('./docker', () => ({
			dockerCheck: jest.fn(),
			dockerBuildpackCompile: dockerBuildpackCompileMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(setOutputMock).toHaveBeenNthCalledWith(1, 'artifact-path', 'test-path');
		expect(setOutputMock).toHaveBeenNthCalledWith(2, 'device-os-version', '4.0.2');
		expect(setFailedMock).not.toHaveBeenCalled();
		expect(nock.pendingMocks()).toEqual([]);
	});

	it('should set the device-os-version output to an actual version when input version is empty', async () => {
		nock('https://binaries.particle.io')
			.get('/firmware-versions-manifest.json')
			.once()
			.replyWithFile(200, `test/fixtures/firmware-manifest-v1/manifest.json`);

		const setOutputMock = jest.fn();
		const setFailedMock = jest.fn();
		jest.mock('@actions/core', () => ({
			getInput: jest.fn().mockImplementation((name: string) => {
				if (name === 'particle-platform-name') {
					return 'argon';
				}
				if (name === 'device-os-version') {
					return '';
				}
				return '';
			}),
			setFailed: setFailedMock,
			info: jest.fn(),
			setOutput: setOutputMock
		}));

		const dockerBuildpackCompileMock = jest.fn().mockResolvedValue('test-path');
		jest.mock('./docker', () => ({
			dockerCheck: jest.fn(),
			dockerBuildpackCompile: dockerBuildpackCompileMock
		}));
		const { compileAction } = await import('./action');
		await compileAction();
		expect(setOutputMock).toHaveBeenNthCalledWith(1, 'artifact-path', 'test-path');
		expect(setOutputMock).toHaveBeenNthCalledWith(2, 'device-os-version', '4.0.2');
		expect(setFailedMock).not.toHaveBeenCalled();
		expect(nock.pendingMocks()).toEqual([]);
	});


});
