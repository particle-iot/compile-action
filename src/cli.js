/* istanbul ignore file */
// Helper functions lifted from CloudCommand.flashDevice in particle-cli
// They are not individually tested in this project, but getCode is tested and uses code here

const path = require('path');
const { existsSync, readFileSync, statSync } = require('fs');
const glob = require('glob');

const MAX_FILE_SIZE = 1024 * 1024 * 10;
const notSourceExtensions = [
	'.ds_store',
	'.jpg',
	'.gif',
	'.png',
	'.include',
	'.ignore',
	'.ds_store',
	'.git',
	'.bin'
];

function getFilenameExt(filename) {
	if (!filename || (filename.length === 0)) {
		return filename;
	}

	const idx = filename.lastIndexOf('.');
	if (idx >= 0) {
		return filename.substr(idx);
	} else {
		return filename;
	}
}

function trimBlankLinesAndComments(arr) {
	if (arr && (arr.length !== 0)) {
		return arr.filter((obj) => {
			return obj && (obj !== '') && (obj.indexOf('#') !== 0);
		});
	}
	return arr;
}

function readAndTrimLines(file) {
	if (!existsSync(file)) {
		return null;
	}

	const str = readFileSync(file).toString();
	if (!str) {
		return null;
	}

	const arr = str.split('\n');
	if (arr && (arr.length > 0)) {
		for (let i = 0; i < arr.length; i++) {
			arr[i] = arr[i].trim();
		}
	}
	return arr;
}

function globList(basepath, arr, { followSymlinks } = {}) {
	let line, found, files = [];
	for (let i = 0; i < arr.length; i++) {
		line = arr[i];
		if (basepath) {
			line = path.join(basepath, line);
		}
		found = glob.sync(line, { nodir: true, follow: !!followSymlinks });

		if (found && (found.length > 0)) {
			files = files.concat(found);
		}
	}
	return files;
}

function compliment(arr, excluded) {
	const { arrayToHashSet } = module.exports;
	const hash = arrayToHashSet(excluded);

	const result = [];
	for (let i = 0; i < arr.length; i++) {
		const key = arr[i];
		if (!hash[key]) {
			result.push(key);
		}
	}
	return result;
}

/**
 * Recursively adds files to compile to an object mapping between relative path on the compile server and
 * path on the local filesystem
 * @param {Array<string>} filenames  Array of filenames or directory names to include
 * @returns {Object} Object mapping from filenames seen by the compile server to local relative filenames
 *
 * use cases:
 * compile someDir
 * compile someFile
 * compile File1 File2 File3 output.bin
 * compile File1 File2 File3 --saveTo anotherPlace.bin
 */
function _handleMultiFileArgs(filenames, { followSymlinks } = {}) {
	const fileMapping = {
		basePath: process.cwd(),
		map: {}
	};

	for (let i = 0; i < filenames.length; i++) {
		const filename = filenames[i];
		const ext = getFilenameExt(filename).toLowerCase();
		const alwaysIncludeThisFile = ((ext === '.bin') && (i === 0) && (filenames.length === 1));

		if (filename.indexOf('--') === 0) {
			// go over the argument
			i++;
			continue;
		}

		let filestats;
		try {
			filestats = statSync(filename);
		} catch (ex) {
			console.error("I couldn't find the file " + filename);
			return null;
		}

		if (filestats.isDirectory()) {
			_processDirIncludes(fileMapping, filename, { followSymlinks });
			continue;
		}

		if (!alwaysIncludeThisFile && notSourceExtensions.includes(ext)) {
			continue;
		}

		if (!alwaysIncludeThisFile && filestats.size > MAX_FILE_SIZE) {
			console.log('Skipping ' + filename + " it's too big! " + filestats.size);
			continue;
		}

		const relative = path.basename(filename);
		fileMapping.map[relative] = filename;
	}

	// return this._handleLibraryExample(fileMapping).then(() => {
	return fileMapping;
	// });
}

/**
 * helper function for getting the contents of a directory,
 * checks for '.include', and a '.ignore' files, and uses their contents
 * instead
 * @param {Object} fileMapping Object mapping from filenames seen by the compile server to local filenames,
 *                             relative to a base path
 * @param {String} dirname
 * @private
 * @returns {nothing} nothing
 */
function _processDirIncludes(fileMapping, dirname, { followSymlinks } = {}) {
	dirname = path.resolve(dirname);
	const files = new Set();

	_getDefaultIncludes(files, dirname, { followSymlinks });
	_getDefaultIgnores(files, dirname, { followSymlinks });
	_getCustomIncludes(files, dirname, { followSymlinks });
	_getCustomIgnores(files, dirname, { followSymlinks });

	// Add files to fileMapping
	const sortedFiles = Array.from(files.values()).sort();
	sortedFiles.forEach((file) => {
		// source relative to the base directory of the fileMapping (current directory)
		const source = path.relative(fileMapping.basePath, file);
		const target = path.relative(dirname, file);
		fileMapping.map[target] = source;
	});
}

function _getDefaultIncludes(files, dirname, { followSymlinks }) {
	// Recursively find source files
	const includes = [
		'**/*.h',
		'**/*.hpp',
		'**/*.hh',
		'**/*.hxx',
		'**/*.ino',
		'**/*.cpp',
		'**/*.c',
		'**/build.mk',
		'project.properties'
	];

	const result = globList(dirname, includes, { followSymlinks });
	result.forEach((file) => files.add(file));
}

function _getCustomIncludes(files, dirname, { followSymlinks }) {
	const includeFiles = globList(dirname, ['**/particle.include'], { followSymlinks });

	for (const includeFile of includeFiles) {
		const includeDir = path.dirname(includeFile);
		const globsToInclude = trimBlankLinesAndComments(readAndTrimLines(includeFile));
		if (!globsToInclude || !globsToInclude.length) {
			continue;
		}
		const includePaths = globList(includeDir, globsToInclude, { followSymlinks });
		includePaths.forEach((file) => files.add(file));
	}
}

function _getDefaultIgnores(files, dirname, { followSymlinks }) {
	// Recursively find default ignore files
	const ignores = [
		'lib/*/examples/**/*.*'
	];

	const result = globList(dirname, ignores, { followSymlinks });
	result.forEach((file) => files.delete(file));
}

function _getCustomIgnores(files, dirname, { followSymlinks }) {
	const ignoreFiles = globList(dirname, ['**/particle.ignore'], { followSymlinks });

	for (const ignoreFile of ignoreFiles) {
		const ignoreDir = path.dirname(ignoreFile);
		const globsToIgnore = trimBlankLinesAndComments(readAndTrimLines(ignoreFile));
		if (!globsToIgnore || !globsToIgnore.length) {
			continue;
		}
		const ignoredPaths = globList(ignoreDir, globsToIgnore.map(g => g), { followSymlinks });
		ignoredPaths.forEach((file) => files.delete(file));
	}
}

function populateFileMapping(fileMapping) {
	if (!fileMapping.map) {
		fileMapping.map = {};
		if (fileMapping.list) {
			for (let i = 0; i < fileMapping.list.length; i++) {
				const item = fileMapping.list[i];
				fileMapping.map[item] = item;
			}
		}
	}
	return fileMapping;
}

module.exports = {
	_handleMultiFileArgs,
	_processDirIncludes,
	_getDefaultIncludes,
	_getCustomIncludes,
	_getDefaultIgnores,
	_getCustomIgnores,
	populateFileMapping
};
