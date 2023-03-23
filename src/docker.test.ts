import { dockerBuildpackCompile, dockerCheck } from './docker';
import fs from "fs";

const execa = require('execa');
jest.mock('execa');
function resetMock() {
	execa.mockImplementation(() => {
		return jest.fn().mockImplementation(() => {
			return {
				stdout: 'Docker version 19.03.8, build afacb8b7f0',
				stderr: '',
				all: 'Docker version 19.03.8, build afacb8b7f0',
				command: 'docker version',
				exitCode: 0,
				killed: false,
				canceled: false,
				pid: 12345,
				connected: true
			};
		});
	});
}

// todo(matt): it actually writes to the file system, so we should mock that
//             or find a better approach
function cleanDir() {
	const dir = 'output';
	if (fs.existsSync(dir) && fs.lstatSync(dir).isDirectory()) {
		fs.rmSync(dir, { recursive: true });
	}
}
beforeEach(() => {
	cleanDir();
});
afterEach(() => {
	cleanDir();
	resetMock();
});

describe('dockerCheck', () => {
	it('should return true if docker is installed', async () => {
		expect(await dockerCheck()).toBe(true);
		expect(execa).toHaveBeenCalledWith('docker', ['version']);
	});

	it('should throw an error if docker is not available', () => {
		execa.mockImplementation(() => {
			// https://github.com/sindresorhus/execa/tree/v5.0.0#childprocessresult
			throw new Error('execa throws when its exit code is not 0');
		});
		expect(dockerCheck()).rejects.toThrow('Docker is not installed or is not available in the path.');
	});
});

describe('dockerBuildpackCompile', () => {
	it('should throw on invalid platform', () => {
		return expect(dockerBuildpackCompile('workingDir', 'sources', 'invalid', 'latest')).rejects.toThrow();
	});

	it('should set target to 4.0.2 if target is latest', async () => {
		const path = await dockerBuildpackCompile('workingDir', 'sources', 'argon', 'latest');
		expect(execa).toHaveBeenCalledTimes(2);
		expect(execa.mock.calls[0]).toEqual([
			'docker',
			[
				'pull',
				'particle/buildpack-particle-firmware:4.0.2-argon'
			]
		]);
		expect(execa.mock.calls[1]).toEqual([
			'docker',
			[
				'run',
				'--rm',
				'-v',
				'workingDir/sources:/input',
				'-v',
				'workingDir/output:/output',
				'-e',
				'PLATFORM_ID=12',
				'particle/buildpack-particle-firmware:4.0.2-argon'
			]]);
		expect(path).toBe('output/firmware.bin');
	});
});
