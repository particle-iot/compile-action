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
			await particleCloudCompile('', 'core', 'token');
		}).rejects.toThrow('No source code path specified');
	});

	it('should throw an error on non-existent directory', () => {
		return expect(async () => {
			await particleCloudCompile('./fake-src-path', 'core', 'token');
		}).rejects.toThrow('Source code ./fake-src-path does not exist');
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
			await particleCloudCompile(emptySrcDir, 'core', 'token');
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
			await particleCloudCompile(emptySrcDir, 'core', 'token');
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
			await particleCloudCompile(emptySrcDir, 'core', 'token');
		}).rejects.toThrow(`There are no valid source code files included in ${emptySrcDir}`);

	});

	it('should handle . source directory', async () => {
		process.chdir('test/fixtures/single-file-firmware');
		await particleCloudCompile('.', 'core', 'token', 'latest');
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'application.cpp'
			},
			'platformId': 0,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' },
		});
	});

	it('should handle ./ source directory', async () => {
		process.chdir('test/fixtures/single-file-firmware');
		await particleCloudCompile('./', 'argon', 'token', 'latest');
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'application.cpp'
			},
			'platformId': 12,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' },
		});
	});

	it('should reset targetVersion to undefined if passed latest', async () => {
		await particleCloudCompile('test/fixtures/single-file-firmware', 'electron', 'token', 'latest');
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(mockCompileCode).toHaveBeenCalledWith({
			'auth': 'token',
			'files': {
				'application.cpp': 'test/fixtures/single-file-firmware/application.cpp'
			},
			'platformId': 10,
			'targetVersion': undefined,
			'headers': { 'User-Agent': 'particle-compile-action' },
		});
	});

	it('should return binary_id on a successful compile', async () => {
		const result = await particleCloudCompile('test/fixtures/single-file-firmware', 'core', 'token');
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(result).toEqual('abc123');
	});

	it('should return undefined on unsuccessful compile', async () => {
		mockCompileCode.mockImplementation(() => ({
			body: {
				ok: false
			}
		}));

		const result = await particleCloudCompile('test/fixtures/single-file-firmware', 'core', 'token');
		expect(mockCompileCode).toHaveBeenCalledTimes(1);
		expect(result).toBeUndefined();
	});

});

describe('particleCloudDownload', () => {

	it('should return a file path on a successful download', async () => {
		const path = await particleDownloadBinary('1234', 'token');
		expect(mockDownloadFirmwareBinary).toHaveBeenCalledTimes(1);
		expect(mockDownloadFirmwareBinary).toHaveBeenCalledWith({
			'binaryId': '1234',
			'auth': 'token',
			'headers': { 'User-Agent': 'particle-compile-action' },
		});
		expect(path).toEqual('output/firmware.bin');
		expect(readFileSync(path || '').toString()).toEqual('test');
	});
});

