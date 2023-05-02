/*
 *  Copyright 2015 Particle ( https://particle.io )
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/*eslint quotes:0*/
'use strict';
var fs = require('fs');
var regexParser = require('./regexParser.js');
var utilities = require('./utilities.js');

var that;
module.exports = that = {
	processFile: function processFile(inputFile, outputFile) {
		console.log('Processing ', inputFile);
		try {
			outputFile = outputFile || inputFile;

			if (utilities.isDirectory(inputFile)) {
				console.log('Skipping directory ' + inputFile);
				return true;
			}

			var fileBuffer = fs.readFileSync(inputFile).toString();
			var ext = utilities.getFilenameExt(inputFile).toLowerCase();

			var unsafeError = this.checkForUnsafeContent(fileBuffer);
			if (unsafeError) {
				console.log('Found unsafe content ' + unsafeError);
				return false;
			}

			// Skip files with PARTICLE_NO_PREPROCESSOR
			var noPreprocessorIdx = regexParser.getNoPreprocessor(fileBuffer);
			if (noPreprocessorIdx >= 0) {
				// Comment out the fake pragma to avoid GCC warning
				fileBuffer = utilities.stringInsert(
					fileBuffer,
					noPreprocessorIdx,
					'// '
				);
			}

			if (noPreprocessorIdx >= 0 ||
				(['.ino', '.pde'].indexOf(ext) < 0)) {
				console.log('Skipping ' + ext + ' file ');
				fs.writeFileSync(outputFile, fileBuffer, {flag: 'w'});
				return true;
			}

			// Check if application.h is already included
			var appIncludeIdx = regexParser.getApplicationInclude(fileBuffer);

			// Add function prototypes after other includes
			var prototypesIdx = regexParser.getFirstStatement(fileBuffer);

			// If prototype position would be before existing application.h move it to later
			if (appIncludeIdx > prototypesIdx) {
				prototypesIdx = fileBuffer.indexOf('\n', appIncludeIdx) + 1;
			}

			// Add a #line preprocessor instruction to sync the errors with the original code
			var linesBeforeInjection = fileBuffer.substring(
				0,
				prototypesIdx
			).split('\n').length;

			// Add function declarations
			var cleanText = regexParser.stripText(fileBuffer);
			var missingFuncs = regexParser.getMissingDeclarations(cleanText);

			var prototypesStr = missingFuncs.join('\n') + '\n'
				+ '#line ' + linesBeforeInjection + ' "' + inputFile + '"\n';
			fileBuffer = utilities.stringInsert(
				fileBuffer,
				prototypesIdx,
				prototypesStr
			);

			// Add application.h to the top of the file unless it is already included
			if (appIncludeIdx === -1) {
				var includeStr = '#include "application.h"\n' +
					'#line 1 "' + inputFile + '"\n';

				fileBuffer = includeStr + fileBuffer;
			}

			fs.writeFileSync(outputFile, fileBuffer, {flag: 'w'});
			return true;
		} catch (ex) {
			console.error('preProcessFile error ' + ex);
		}

		return false;
	},

	checkForUnsafeContent: function checkForUnsafeContent(fileBuffer) {
		var issues = null;
		if (!fileBuffer) {
			return issues;
		}

		// RELATIVE INCLUDES ONLY!  NO ABSOLUTE INCLUDES!!!
		// NO POPPING UP MORE THAN 2 parent directories!
		var unsafeChunks = [
			'#include "/',
			'#include </',
			'#include "../../../',
			'#include <../../../'
		];

		for (var i = 0; i < unsafeChunks.length; i++) {
			var chunk = unsafeChunks[i];

			if (fileBuffer.indexOf(chunk) >= 0) {
				issues = 'Found: ' + chunk;
				break;
			}
		}

		return issues;
	},

	foo: null
};

module.exports = that;
