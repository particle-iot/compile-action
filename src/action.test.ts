describe('compileAction', () => {

	afterEach(() => {
		jest.resetModules();
	});

	it('should use compile locally with docker by default', async () => {
		const dockerCheckMock = jest.fn();
		const dockerBuildpackCompileMock = jest.fn();
		jest.mock('./util', () => ({
			resolveVersion: jest.fn(),
			validatePlatformName: jest.fn(),
			validatePlatformDeviceOsTarget: jest.fn()
		}));
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
		jest.mock('./util', () => ({
			resolveVersion: jest.fn(),
			validatePlatformName: jest.fn(),
			validatePlatformDeviceOsTarget: jest.fn()
		}));
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

});
