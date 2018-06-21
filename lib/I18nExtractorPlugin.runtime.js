/*
 * (C) Copyright HCL Technologies Ltd. 2018
 * (C) Copyright IBM Corp. 2012, 2017 All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*eslint-env browser:true, es6:false*/
var __webpack_require__, getUserLocale;		// for linter

/*
 * Runtime functions used on the client.  No ES6 code here!
 */
function mapLanguageChunks(id, map, languages) {
 var chunks = map[id];
 if (chunks) {
   var locale = getUserLocale && getUserLocale();
   if (!locale) {
     locale = getNavigatorLocale();
   }
   var lang = locale.match(/^[^-]*/)[0];
   var idx = languages.indexOf(lang);
   if (idx !== -1) return chunks[idx];
 }
}

function getNavigatorLocale() {
 return ((navigator.languages && navigator.languages[0]) ||
  navigator.language || navigator.userLanguage).toLowerCase();
}

function loadLanguageChunks(chunkId) {
 var chunkMap = __chunk_map__; // eslint-disable-line
 var languages = __languages__; // eslint-disable-line
 var promises, langChunkIds = mapLanguageChunks(chunkId, chunkMap, languages);
 if (langChunkIds) {
   // Make it an array
   if (!Array.isArray(langChunkIds)) {
     langChunkIds = [langChunkIds];
   }
   promises = langChunkIds.map(function(langChunkId) {
     return __webpack_require__.e(langChunkId);
   });
 }
 return promises || [];
}


module.exports = {
  mapLanguageChunks: mapLanguageChunks,
  getNavigatorLocale: getNavigatorLocale,
  loadLanguageChunks: loadLanguageChunks
};
