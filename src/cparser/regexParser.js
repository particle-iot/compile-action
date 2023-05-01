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
/*eslint max-len:0*/
'use strict';
/**
 *
 * This library is a basic attempt at identifying wiring-compatible
 * source files, and providing the functions
 * necessary to translate them into firmware compilable C code.
 */

var utilities = require('./utilities.js');

// identify function declarations
// c language requires functions to be declared before they are used,
// but wiring language do not.

// identify functions
// once we've identified functions without declarations, we can add the
// missing sections

// identify header includes
// we must add any missing header includes, but also keep any user
// supplied headers.

var that;
module.exports = that = {
	matchAll: function matchAll(expr, str) {
		var m, matches = [];

		while ((m = expr.exec(str)) !== null) {
			matches.push(m);
		}
		return matches;
	},

	functions: {
		declarations: function declarations(str) {
			// Since these don't handle comments those need to be
			// removed separately.
			var declrRegex = new RegExp("[\\w\\[\\]\\*]+\\s+[&\\[\\]\\*\\w\\s]+\\([&,\\[\\]\\*\\w\\s]*\\)(?=\\s*\\;);", 'gm');
			return that.matchAll(declrRegex, str);
		},
		definitions: function definitions(str) {
			var fnRegex = new RegExp("[\\w\\[\\]\\*]+\\s+[&\\[\\]\\*\\w\\s]+\\([&,\\[\\]\\*\\w\\s]*\\)(?=\\s*\\{)", 'gm');
			return that.matchAll(fnRegex, str);
		}
	},

	includes: {
		findAll: function findAll(str) {
			var fnRegex = new RegExp("#include ((<[^>]+>)|(\"[^\"]+\"))", 'gm');
			return that.matchAll(fnRegex, str);
		}
	},

	types: {
		declarations: function declarations(str) {
			var typeRegex = new RegExp(/\b(class|struct|enum)\b\s+(\w+)/gm);
			return that.matchAll(typeRegex, str);
		},
		typedefs: function typedefs(str) {
			var typedefRegex = new RegExp(/\btypedef\s+(struct|enum)\b\s*{[^}]*}\s*(\w+)/gm);
			return that.matchAll(typedefRegex, str);
		}
	},

	/**
	 * Strip out anything the function definition code doesn't deal with well.
	 * Essentially anything that couldn't possibly contain a function def.
	 */
	stripText: function stripText(contents) {
		var cruft = new RegExp(
				"('.')" +
				"|(\"(?:[^\"\\\\]|\\\\.)*\")" +
				"|(//.[^\n]*)" +
				"|(/\\*[^*]*(?:\\*(?!/)[^*]*)*\\*/)" +
				"|(^\\s*#.*?$)"
			, 'mgi');

		return contents.replace(cruft, '');
	},

	getNoPreprocessor: function getMagicPragma(contents) {
		var re = new RegExp(
			'^[ \t]*#pragma (SPARK_NO_PREPROCESSOR|PARTICLE_NO_PREPROCESSOR)',
			'm'
		);
		var noPreprocessorMatch = contents.match(re);

		if (noPreprocessorMatch) {
			return noPreprocessorMatch.index;
		} else {
			return -1;
		}
	},

	getApplicationInclude: function getApplicationInclude(contents) {
		var re = new RegExp(
			'^[ \t]*#include [<"](application.h|Particle.h|Arduino.h)[>"]',
			'm'
		);
		var applicationIncludeMatch = contents.match(re);

		if (applicationIncludeMatch) {
			return applicationIncludeMatch.index;
		} else {
			return -1;
		}
	},

	getMissingDeclarations: function getMissingDeclarations(contents) {
		// All the ones that don't need extra declarations
		var found = that.functions.declarations(contents);
		found = that.flattenRegexResults(found);

		// All the user defined types
		var typesDeclarations = that.types.declarations(contents);
		var typesTypedef = that.types.typedefs(contents);
		var types = [].concat(
			that.flattenRegexResults(typesDeclarations, 2),
			that.flattenRegexResults(typesTypedef, 2)
		);

		// All the functions we have
		var defined = that.functions.definitions(contents);
		defined = that.flattenRegexResults(defined);
		defined = that.removeSpecialCaseDefinitions(defined);
		defined = that.removeDefinitionsWithCustomTypes(defined, types);
		for (var i = 0; i < defined.length; i++) {
			defined[i] = defined[i] + ';';
		}

		// All the ones we're missing
		return utilities.setComplement(defined, found);
	},

	/**
	 * just the strings please.
	 * @param results
	 * @param group The capture group to return or the entire match
	 */
	flattenRegexResults: function flattenRegexResults(results, group) {
		group = group || 0;
		if (results) {
			for (var i = 0; i < results.length; i++) {
				results[i] = results[i][group];
			}
		}
		return results;
	},

	/**
	 * remove things that look like definitions but are not
	 */
	removeSpecialCaseDefinitions: function removeSpecialCaseDefinitions(defined) {
		var wellDefined = [];
		var specialCases = [
			new RegExp(/\belse\b\s+\bif\b/) /* else if(foo) */
		];
		next_definition:
		for (var i = 0; i < defined.length; i++) {
			// remove special cases
			for (var j = 0; j < specialCases.length; j++) {
				if (specialCases[j].test(defined[i])) {
					continue next_definition;
				}
			}
			wellDefined.push(defined[i]);
		}
		return wellDefined;
	},

	/**
	 * remove definitions with custom classes, structs and enums as parameters
	 */
	removeDefinitionsWithCustomTypes: function removeDefinitionsWithCustomTypes(defined, types) {
		var i;
		var builtinDefined = [];
		var customTypes = [];
		for (i = 0; i < types.length; i++) {
			customTypes[i] = new RegExp("\\b" + types[i] + "\\b");
		}
		next_definition:
		for (i = 0; i < defined.length; i++) {
			// remove custom types
			for (var j = 0; j < customTypes.length; j++) {
				if (customTypes[j].test(defined[i])) {
					continue next_definition;
				}
			}
			builtinDefined.push(defined[i]);
		}
		return builtinDefined;
	},

	// Return the line number of the first statement in the code
	getFirstStatement: function getFirstStatement(contents) {

		// Find the first thing that isn't these.
		var nonStatement = [
			// Whitespace
			"\\s+",

			// Comments
			"|(/\\*[^*]*(?:\\*(?!/)[^*]*)*\\*/)|(//.*?$)",

			// Include statements
			"|(#include.+$)"
		];

		var pat = new RegExp(nonStatement.join(''), 'mgi');
		var lastMatch = 0;

		var match;
		while ((match = pat.exec(contents)) !== null) {
			if (match.index !== lastMatch) {
				break;
			}
			lastMatch = match[0].length + match.index;
		}

		return lastMatch;
	},

	foo: null
};
