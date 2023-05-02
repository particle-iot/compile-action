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

'use strict';
var fs = require('fs');

module.exports = {
	getFilenameExt: function getFilenameExt(filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		var idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(idx);
		} else {
			return filename;
		}
	},

	getFilenameNoExt: function getFilenameNoExt(filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		var idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(0, idx);
		} else {
			return filename;
		}
	},

	/**
	 * apparently this isn't already baked in?
	 * @param str
	 * @param idx
	 * @param val
	 */
	stringInsert: function stringInsert(str, idx, val) {
		return str.substring(0, idx) + val + str.substring(idx);
	},

	/**
	 * Give the set of items in required that aren't in found
	 * @param required
	 * @param found
	 */
	setComplement: function setComplement(required, found) {
		var hash = {};
		for (var i = 0; i < found.length; i++) {
			hash[found[i]] = true;
		}

		var results = [];
		for (var i = 0; i < required.length; i++) {
			var item = required[i];
			if (hash[item]) {
				continue;
			}
			results.push(item);
		}
		return results;
	},

	isDirectory: function isDirectory(filePath) {
		try {
			var stat = fs.statSync(filePath);
			return stat.isDirectory();
		} catch (ex) {}
		return false;
	},

	_: null
};
