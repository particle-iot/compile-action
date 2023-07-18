/**
 * Tests ported from CLI PR 646 to support particle.include and particle.ignore
 * https://github.com/particle-iot/particle-cli/pull/646/files
 */

import tmp from 'tmp';
import { dirname, join, resolve } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import {
	_processDirIncludes,
	_getDefaultIncludes,
	_getCustomIncludes,
	_getDefaultIgnores,
	_getCustomIgnores
} from './cli';

async function createTmpDir(
	files: string[],
	fileContents: { [key: string]: string },
	// eslint-disable-next-line no-unused-vars
	handler: (dir: string) => Promise<void>
) {
	const tmpDir = tmp.dirSync({ unsafeCleanup: true });
	for (const file of files) {
		const filePath = join(tmpDir.name, file);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, fileContents[file] || '');
	}
	try {
		await handler(tmpDir.name);
	} finally {
		tmpDir.removeCallback();
	}
}

describe('_processDirIncludes', () => {
	it('gets the list of files', async () => {
		await createTmpDir([
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h'
		], {}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('src/app.cpp')]: join('src/app.cpp'),
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h')
			});
		});
	});

	it('gets the list of files with include and ignore configs', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/spi.def',
			'lib/spi/src/spi.cmd',
			'lib/spi/examples/sensor/spi_example.cpp',
			'lib/spi/examples/sensor/spi_example.h',
			'lib/spi/particle.include',
			'lib/i2c/src/i2c.c',
			'lib/i2c/particle.ignore'
		], {
			'particle.include': '**/*.def',
			'lib/spi/particle.include': '**/*.cmd',
			'lib/i2c/particle.ignore': '**/*.c'
		}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('src/app.cpp')]: join('src/app.cpp'),
				[join('src/app.def')]: join('src/app.def'),
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h'),
				[join('lib/spi/src/spi.def')]: join('lib/spi/src/spi.def'),
				[join('lib/spi/src/spi.cmd')]: join('lib/spi/src/spi.cmd')
			});
		});
	});

	it('does not return files that are not included', async () => {
		await createTmpDir([
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/spi.txt'
		], {}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('src/app.cpp')]: join('src/app.cpp'),
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h')
			});
		});
	});

	it('returns files that are included', async () => {
		await createTmpDir([
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/spi.txt',
			'lib/particle.include'
		], {
			'lib/particle.include': '**/*.txt'
		}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('src/app.cpp')]: join('src/app.cpp'),
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h'),
				[join('lib/spi/src/spi.txt')]: join('lib/spi/src/spi.txt')
			});
		});
	});

	it('removes duplicates if included multiple times', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/spi.txt',
			'lib/particle.include'
		], {
			'particle.include': '**/*.cpp',
			'lib/particle.include': '**/*.txt'
		}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('src/app.cpp')]: join('src/app.cpp'),
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h'),
				[join('lib/spi/src/spi.txt')]: join('lib/spi/src/spi.txt')
			});
		});
	});

	it('removes files which are in ignore list', async () => {
		await createTmpDir([
			'particle.ignore',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/spi.txt',
			'lib/particle.include'
		], {
			'particle.ignore': '**/*.cpp',
			'lib/particle.include': '**/*.txt'
		}, async (dir) => {
			const fileMapping = { basePath: dir, map: {} };

			await _processDirIncludes(fileMapping, dir);

			expect(fileMapping.map).toEqual({
				[join('lib/spi/src/spi.c')]: join('lib/spi/src/spi.c'),
				[join('lib/spi/src/spi.h')]: join('lib/spi/src/spi.h'),
				[join('lib/spi/src/spi.txt')]: join('lib/spi/src/spi.txt')
			});
		});
	});
});

describe('_getDefaultIncludes', () => {
	it('gets the list of files to include by default', async () => {
		await createTmpDir([
			'src/app.ino',
			'src/app.cpp',
			'src/app.hpp',
			'src/app.hh',
			'src/app.hxx',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/src/build.mk'
		], {}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getDefaultIncludes(files, dir, { followSymlinks: false });

			expect([...files].sort()).toEqual([
				resolve(dir, 'src/app.ino'),
				resolve(dir, 'src/app.cpp'),
				resolve(dir, 'src/app.hpp'),
				resolve(dir, 'src/app.hh'),
				resolve(dir, 'src/app.hxx'),
				resolve(dir, 'lib/spi/src/spi.c'),
				resolve(dir, 'lib/spi/src/spi.h'),
				resolve(dir, 'lib/spi/src/build.mk')
			].sort());
		});
	});

	it('filters out files which are not in the default blob', async () => {
		await createTmpDir([
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'src/app.txt',
			'lib/spi/src/spi.txt',
		], {}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getDefaultIncludes(files, dir, { followSymlinks: false });

			expect([...files].sort()).toEqual([
				resolve(dir, 'src/app.cpp'),
				resolve(dir, 'lib/spi/src/spi.c'),
				resolve(dir, 'lib/spi/src/spi.h')
			].sort());
		});
	});
});

describe('_getCustomIncludes', () => {
	it('gets the list of files to include via particle.include', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'src/app.def'
		], { 'particle.include': '**/*.def' }, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([
				resolve(dir, 'src/app.def')
			]);
		});
	});

	it('gets the list of nested files to include via particle.include', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'src/file.txt',
			'src/particle.include',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h'
		], {
			'particle.include': '**/*.def',
			'src/particle.include': '**/*.txt\n**/*.def'
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([
				resolve(dir, 'src/app.def'),
				resolve(dir, 'src/file.txt')
			]);
		});
	});

	it('gets the list of files from nested directories', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'lib/particle.include',
			'lib/file.txt',
			'lib/file.def',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h'
		], {
			'particle.include': '**/*.def',
			'lib/particle.include': '**/*.txt\n**/*.def'
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files].sort()).toEqual([
				resolve(dir, 'src/app.def'),
				resolve(dir, 'lib/file.txt'),
				resolve(dir, 'lib/file.def')
			].sort());
		});
	});

	it('handles repeated files from nested directories', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'lib/particle.include',
			'lib/file.txt',
			'lib/file.def',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h'
		], {
			'particle.include': '**/*.def',
			'lib/particle.include': '**/*.txt\n**/*.def'
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files].sort()).toEqual([
				resolve(dir, 'src/app.def'),
				resolve(dir, 'lib/file.txt'),
				resolve(dir, 'lib/file.def')
			].sort());
		});
	});

	it('handles an empty particle.include', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'src/app.def'
		], {}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});

	it('handles empty particle.include in a nested dir', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/particle.include'
		], {
			'particle.include': '**/*.def',
			'lib/particle.include': ''
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([
				resolve(dir, 'src/app.def')
			]);
		});
	});

	it('handles multiple empty particle.include files', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'src/app.def',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/particle.include'
		], {
			'particle.include': '',
			'lib/particle.include': ''
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});

	it('should not error if files are not found', async () => {
		await createTmpDir([
			'particle.include',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
		], {
			'particle.include': '**/*.def',
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIncludes(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});
});

describe('_getDefaultIgnores', () => {
	it('gets the list of files to ignore', async () => {
		await createTmpDir([
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/spi/examples/sensor/init.ino'
		], {}, async (dir) => {
			dir = resolve(dir);
			// hardcode a set with 'lib/spi/examples/sensor/init.ino'
			const files = new Set([
				join(dir, 'lib/spi/examples/sensor/init.ino')
			]);

			_getDefaultIgnores(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});
});

describe('_getCustomIgnores', () => {
	it('gets the list of files to ignore', async () => {
		await createTmpDir([
			'particle.ignore',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
		], {
			'particle.ignore': '**/*.cpp',
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set([
				join(dir, 'src/app.cpp')
			]);

			_getCustomIgnores(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});

	it('handles multiple particle.ignore files', async () => {
		await createTmpDir([
			'particle.ignore',
			'lib/particle.ignore',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
		], {
			'particle.ignore': '**/*.cpp',
			'lib/particle.ignore': '**/*.h',
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set([
				join(dir, 'src/app.cpp'),
				join(dir, 'lib/spi/src/spi.h')
			]);

			_getCustomIgnores(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});

	it('handles an empty particle.ignore', async () => {
		await createTmpDir([
			'particle.ignore',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
		], {
			'particle.ignore': '',
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set();

			_getCustomIgnores(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});

	it('handles empty particle.ignore in a nested dir', async () => {
		await createTmpDir([
			'particle.ignore',
			'src/app.cpp',
			'lib/spi/src/spi.c',
			'lib/spi/src/spi.h',
			'lib/particle.ignore'
		], {
			'particle.ignore': '**/*.cpp',
			'lib/particle.ignore': ''
		}, async (dir) => {
			dir = resolve(dir);
			const files = new Set([
				join(dir, 'src/app.cpp')
			]);

			_getCustomIgnores(files, dir, { followSymlinks: false });

			expect([...files]).toEqual([]);
		});
	});
});
