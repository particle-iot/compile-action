import { sep } from 'node:path';
import { mkdtemp } from 'node:fs';
import { tmpdir } from 'os';
import { readFileSync, writeFileSync } from 'fs';

// Need to be before imports
const mockCompileCode = jest.fn().mockImplementation(() => {
	return {
		body: {
			ok: true,
			binary_id: 'abc123'
		}
	};
});
const mockDownloadFirmwareBinary = jest.fn().mockImplementation(() => {
	return Buffer.from('test');
});
import { particleCloudCompile, particleDownloadBinary } from './particle-api';
import * as fs from 'fs';

jest.mock('particle-api-js', () => {
	return jest.fn().mockImplementation(() => {
		return {
			compileCode: mockCompileCode,
			downloadFirmwareBinary: mockDownloadFirmwareBinary
		};
	});
});

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
});

describe('particleCloudCompile', () => {
	const originalDir = process.cwd();

	afterEach(() => {
		process.chdir(originalDir);
	});

	it('should throw an error if passed empty string', () => {
		return expect(async () => {
			await particleCloudCompile({
				sources: '',
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow('No source code sources specified');
	});

	it('should throw an error on non-existent directory', () => {
		return expect(async () => {
			await particleCloudCompile({
				sources: './fake-src-sources',
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow('Source code ./fake-src-sources does not exist');
	});

	it('should throw an error on an empty directory', async () => {
		// make a fake directory
		const tmpDir = tmpdir();
		const emptySrcDir: any = await new Promise((resolve, reject) => {
			mkdtemp(`${tmpDir}${sep}`, (err, folder) => {
				if (err) {
					reject(err);
				}
				resolve(folder);
			});
		});

		return expect(async () => {
			await particleCloudCompile({
				sources: emptySrcDir,
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow(`There are no valid source code files included in ${emptySrcDir}`);
	});

	it('should throw an error on an directory with no valid source code files', async () => {
		const tmpDir = tmpdir();
		const emptySrcDir: any = await new Promise((resolve, reject) => {
			mkdtemp(`${tmpDir}${sep}`, (err, folder) => {
				if (err) {
					reject(err);
				}
				resolve(folder);
			});
		});
		const testFile = `${emptySrcDir}${sep}not-source-code.txt`;
		writeFileSync(testFile, 'test');

		return expect(async () => {
			await particleCloudCompile({
				sources: emptySrcDir,
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow(`There are no valid source code files included in ${emptySrcDir}`);

	});

	it('should throw an error on an directory with no valid source code files', async () => {
		const tmpDir = tmpdir();
		const emptySrcDir: any = await new Promise((resolve, reject) => {
			mkdtemp(`${tmpDir}${sep}`, (err, folder) => {
				if (err) {
					reject(err);
				}
				resolve(folder);
			});
		});
		const testFile = `${emptySrcDir}${sep}not-source-code.txt`;
		writeFileSync(testFile, 'test');

		return expect(async () => {
			await particleCloudCompile({
				sources: emptySrcDir,
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow(`There are no valid source code files included in ${emptySrcDir}`);

	});

	it('should handle . source directory', async () => {
		process.chdir('test/fixtures/single-file-firmware');
		await particleCloudCompile({
			sources: '.',
			platform: 'core',
			auth: 'token',
			targetVersion: 'latest'
		});
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'application.cpp'
			},
			'platformId': 0,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' }
		});
	});

	it('should handle ./ source directory', async () => {
		process.chdir('test/fixtures/single-file-firmware');
		await particleCloudCompile({
			sources: './',
			platform: 'argon',
			auth: 'token',
			targetVersion: 'latest'
		});
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'application.cpp'
			},
			'platformId': 12,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' }
		});
	});

	it('should reset targetVersion to undefined if passed latest', async () => {
		await particleCloudCompile({
			sources: 'test/fixtures/single-file-firmware',
			platform: 'electron',
			auth: 'token',
			targetVersion: 'latest'
		});
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'test/fixtures/single-file-firmware/application.cpp'
			},
			'platformId': 10,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' }
		});
	});

	it('should return binary_id on a successful compile', async () => {
		const result = await particleCloudCompile({
			sources: 'test/fixtures/single-file-firmware',
			platform: 'core',
			auth: 'token'
		});
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(result).toEqual('abc123');
	});

	it('should return an empty string on a user-error compile', async () => {
		mockCompileCode.mockImplementation(() => {
			const err: Error = Error('Compilation failed');
			// @ts-ignore
			err.body = {
				ok: false,
				code: 200,
				output: 'Compiler timed out or encountered an error',
				errors: ['make -C ../modules/p1/user-part all\n']
			};
			throw err;
		});

		const result = await particleCloudCompile({
			sources: 'test/fixtures/single-file-firmware',
			platform: 'core',
			auth: 'token'
		});
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(result).toEqual('');
	});

	it('should throw when there is a unknown response from the cloud', async () => {
		mockCompileCode.mockImplementation(() => ({
			body: {
				ok: false
			}
		}));

		return expect(async () => {
			await particleCloudCompile({
				sources: 'test/fixtures/single-file-firmware',
				platform: 'core',
				auth: 'token'
			});
		}).rejects.toThrow(`Error: unknown response from Particle Cloud: {"body":{"ok":false}}`);

	});

});

describe('particleCloudDownload', () => {

	it('should return a file sources on a successful download', async () => {
		const path = await particleDownloadBinary({ binaryId: '1234', auth: 'token' });
		expect(mockDownloadFirmwareBinary).toHaveBeenCalledTimes(1);
		expect(mockDownloadFirmwareBinary).toHaveBeenCalledWith({
			'binaryId': '1234',
			'auth': 'token',
			'headers': { 'User-Agent': 'particle-compile-action' }
		});
		expect(path).toEqual('output/firmware.bin');
		expect(readFileSync(path || '').toString()).toEqual('test');
	});
});

