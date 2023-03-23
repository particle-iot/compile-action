import { dockerCheck } from './docker';

const execa = require('execa');
jest.mock('execa');
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
	it
});
