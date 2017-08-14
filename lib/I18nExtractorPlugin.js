/*
 * (C) Copyright IBM Corp. 2012, 2016 All Rights Reserved.
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

/*
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * ATTENTION!!! If you make changes to this file that affect the generated code,
 * be sure to update the hash generation function at the end of the file.
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */

const I18nExtractorItemDependency = require("./I18nExtractorItemDependency");
const runtime = require("./I18nExtractorPlugin.runtime");

const BLOCK_COMMENT = "/* i18n extractor */";
const CHUNK_REASON = "language extraction";

module.exports = class I18nExtractorPlugin {
  constructor(options) {
    this.options = options || [];
    if (!this.options.output) {
      this.options.output = {};
    }
    this.depChunks = [];
  }
  apply(compiler) {
    const options = this.options;
    // Returns true if all the modules in containedChunk are also in containerChunk
    function containsAll(containerChunk, containedChunk) {
      if (containerChunk === containedChunk || containerChunk.getNumberOfModules() < containedChunk.getNumberOfModules() || containerChunk.chunks.length === 0) {
        return false;
      }
      // Make sure both chunks are language chunks and that they are for the same language.
      if (!containerChunk.lang || !containedChunk.lang || containerChunk.lang !== containedChunk.lang) {
        return false;
      }
      return containedChunk.getModules().every((module) => {
        return containerChunk.containsModule(module);
      });
    };

    compiler.plugin("compilation", (compilation, params) => {
      compilation.dependencyFactories.set(I18nExtractorItemDependency, params.normalModuleFactory);
      compilation.dependencyTemplates.set(I18nExtractorItemDependency, new I18nExtractorItemDependency.Template());

      compilation.plugin("after-optimize-tree", () =>{
        // For each chunk, move all the non-default nls files to language specific chunks
        const langChunks = [];
        compilation.chunks.forEach((chunk) => {
          if (options.excludeChunks && chunk.name && options.excludeChunks.indexOf(chunk.name) !== -1) {
            return; // ignore this chunk
          }
          chunk.languages = {};
          const langModules = [];
          chunk.forEachModule((module) => {
            const match = /[\/\\]nls[\/\\]([a-zA-z_-]+)[\/\\]([^\/\\]*)\.js$/.exec(module.request);
            if (match && match[1] && match[1] !== 'root') {
              langModules.push({module: module, match: match});
            }
          });
          langModules.forEach((entry) => {
            // get only the language part of the locale
            var lang = entry.match[1].match("^[^-]*")[0];
            if (lang) {
              if (options.map) {
                lang = options.map[lang] || lang;
              }
              var langChunk = chunk.languages[lang];
              if (!langChunk) {
                // chunk for the language doesn't exist yet.  Create it
                langChunk = compilation.addChunk(chunk.name && (`${chunk.name}_nls-${lang}`) || undefined);
                langChunk.lang = lang;
                langChunk.chunkReason = CHUNK_REASON;
                langChunk.chunks.push(chunk);
                chunk.chunks.push(langChunk);
                chunk.languages[lang] = langChunk;
                langChunks.push(langChunk);
                if (chunk.isInitial() && options.output.filename) {
                  langChunk.filenameTemplate = options.output.filename;
                } else if (!chunk.isInitial() && options.output.chunkFilename) {
                  langChunk.filenameTemplate = options.output.chunkFilename;
                }
              }
              // Move the module
              chunk.removeModule(entry.module);
              entry.module.removeChunk(chunk);
              langChunk.addModule(entry.module);
              entry.module.addChunk(langChunk);
            }
          });
        });

        // Now consolidate the language chunks
        const toRemove = [];
        langChunks.forEach((langChunk) => {
          langChunks.forEach((chunk) => {
            if (langChunk !== chunk && toRemove.indexOf(langChunk) === -1 && toRemove.indexOf(chunk) === -1) {
              if (containsAll(langChunk, chunk)) {
                // langChunk contains all the modules in chunk
                if (langChunk.getNumberOfModules() === chunk.getNumberOfModules()) {
                  // The chunks are identical.  Remove one of them
                  chunk.chunks.forEach((c) => {
                    c.chunks.splice(c.chunks.indexOf(chunk), 1, langChunk);
                    langChunk.chunks.push(c);
                    const lang = langChunk.lang;
                    if (Array.isArray(c.languages[lang])) {
                      c.languages[lang].splice(c.languages[lang].indexOf(chunk),1,langChunk);
                    } else {
                      c.languages[lang] = langChunk;
                    }
                  });
                  chunk.chunks = [];
                  toRemove.push(chunk);
                } else {
                  // chunk is a subset of the modules contained in langChunk
                  // remove chunk's modules from langChunk and update the modules
                  // that depend on langChunk to load both chunk and langChunk
                  chunk.forEachModule((module) => {
                    langChunk.removeModule(module);
                    module.removeChunk(langChunk);
                  });
                  langChunk.chunks.forEach((c) => {
                    c.chunks.push(chunk);
                    const lang = langChunk.lang;
                    if (!Array.isArray(c.languages[lang])) {
                      c.languages[lang] = [c.languages[lang]];
                    }
                    c.languages[lang].push(chunk);
                  });
                }
              }
            }
          });
        });
        toRemove.forEach((chunk) => {
          chunk.mapModules((m) => {return m;}).forEach((module) => {
            chunk.removeModule(module);
            module.removeChunk(chunk);
          });
          compilation.chunks.splice(compilation.chunks.indexOf(chunk), 1);
        });
      });

      function mapLanguageChunkNames(data) {
        return compilation.chunks.filter((chunk) => {
          return chunk.chunkReason === CHUNK_REASON && chunk.lang && chunk.filenameTemplate;
        }).reduce((a, chunk) => {
          a[chunk.id] = compilation.mainTemplate.applyPluginsWaterfall("asset-path", chunk.filenameTemplate, {
            chunk: chunk,
            hash: data.hash || compilation.hash,
            noChunkHash: false
          });
          return a;
        }, {});
      }

      compilation.mainTemplate.plugin("require-extensions", function(source, chunk) {
        if(chunk.chunks.length === 0) return source;
        // Runs in context of plugin executor
        // emit functions used by require-ensure additions
        const buf = [];
        buf.push(source);
        buf.push(BLOCK_COMMENT);
        buf.push(runtime.getNavigatorLocale.toString());
        buf.push("var getUserLocale;");
        if (typeof options.getUserLocale === 'function') {
          buf.push("getUserLocale = " + options.getUserLocale.toString());
        }
        buf.push(BLOCK_COMMENT);
        buf.push(runtime.mapLanguageChunks.toString());
        buf.push(BLOCK_COMMENT);
        buf.push(runtime.loadLanguageChunks.toString());
        return this.asString(buf);
      });

      compilation.mainTemplate.plugin("startup", function(source, chunk) {
        if(chunk.chunks.length === 0 || options.noLoadEntryChunkResources) return source;
        const buf = [];
        buf.push(`__webpack_require__.e(${JSON.stringify(chunk.id)}).then(function() {  ${BLOCK_COMMENT}`);
        buf.push(this.indent(source));
        buf.push(`});  ${BLOCK_COMMENT}`);
        return this.asString(buf);
      });

      compilation.mainTemplate.plugin("bootstrap", function(source, chunk) {
        if(chunk.chunks.length === 0 || options.noLoadEntryChunkResources) return source;
        // Regretably, the jsonp bootstrap code does not provide fine grained enough plugin
        // hooks, so we need to muck with the provided source.
        const buf = source.split("\n");
        const i = buf.findIndex((line) => {
          return /if\s*\(executeModules\)\s*\{/.test(line);
        });
        if (i !== -1) {
          // find the matching closing brace with same indentation
          const match = /^(\s*)/.exec(buf[i]);
          const indent = match && match[1] || '';
          const test = `${indent}}`;
          let j;
          for (j = i+1; j < buf.length; j++) {
            if (buf[j] === test) break;
            else buf[j] = this.indent(buf[j]);
          }
          if (j === buf.length) {
            throw new Error("Unrecognized bootstrap code.  Try updating your version of webpack-i18n-extractor-plugin");
          }
          buf.splice(i+1, 0, indent + this.indent(`Promise.all(chunkIds.map(function(id){return __webpack_require__.e(id);})).then(function() {  ${BLOCK_COMMENT}`));
          buf.splice(j+1, 0, indent + this.indent(`});  ${BLOCK_COMMENT}`));
        }
        return this.asString(buf);
      });

      compilation.mainTemplate.plugin("require-ensure", function(source, chunk) {
        // Emit code to load the language specific nls chunk in addition to the requested chunk
        const sortedLangs = Object.keys(compilation.chunks.reduce((a, c) => {
          return Object.assign(a, c.languages || {});
        }, {})).sort();
        const map = compilation.chunks.reduce((a1, c) => {
          const chunkIds = Object.keys(c.languages || {}).reduce((a2, lang) => {
            const elem = c.languages[lang];
            a2[sortedLangs.indexOf(lang)] = Array.isArray(elem) ? elem.map((o) => { return o.id;}) : elem.id;
            return a2;
          }, []);
          if (chunkIds.length) {
            a1[`${c.id}`] = chunkIds;
          }
          return a1;
        }, []);

        const buf = [];
        // Return a promise that resolves when the requested chunk and the associated language chunks have been
        // loaded.
        buf.push(`return Promise.all([(function() { ${BLOCK_COMMENT}`);
        buf.push(this.indent(`if (chunkId === ${JSON.stringify(chunk.id)}) return Promise.resolve();  ${BLOCK_COMMENT}`));
        buf.push(this.indent(source));
        buf.push(`})()].concat(  ${BLOCK_COMMENT}`);
        buf.push(this.indent(`loadLanguageChunks(chunkId, ${JSON.stringify(map)}, ${JSON.stringify(sortedLangs)})  ${BLOCK_COMMENT}`));
        buf.push(`));  ${BLOCK_COMMENT}`);
        return this.asString(buf);
      });

      params.normalModuleFactory.plugin("parser", (parser) => {
        parser.plugin("call require:commonjs:item", (expr, param) => {
          // Handle common JS require for nls resources
          if (param.isString() && /[\/\\]nls[\/\\]([a-zA-z_-]+)[\/\\]([^\/\\]+)$/.test(param.string)) {
            const dep = new I18nExtractorItemDependency(param.string, [expr.start, expr.end]);
            dep.loc = expr.loc;
            dep.optional = !!parser.scope.inTry;
            parser.state.current.addDependency(dep);
            return true;
          }
        });
      });

      compilation.mainTemplate.plugin("asset-path", (filename, data) => {
        if (data.chunk && data.chunk.chunkReason === CHUNK_REASON && data.chunk.lang) {
          let parentName = '', parentId = '';
          const parentChunk = data.chunk.chunks && data.chunk.chunks[0];
          if (parentChunk) {
            parentName = parentChunk.name;
            parentId = parentChunk.id;
          }
          filename = filename
            .replace(/\[parentname\]/, parentName)
            .replace(/\[parentid\]/, `${parentId}`)
            .replace(/\[lang\]/, data.chunk.lang);
        } else if (data.chunk && data.chunk.id === "\" + chunkId + \"") {
          const map = mapLanguageChunkNames(data);
          if (Object.keys(map).length > 0) {
            filename = `(${BLOCK_COMMENT} ${JSON.stringify(map)}[chunkId] || ${filename})`;
          }
        }
        return filename;
      });

      compilation.mainTemplate.plugin("hash", (hash) => {
        hash.update("webpack-i18n-extractor-plugin");
        hash.update("6");   // Increment this whenever the render code above changes
      });
    });
  }
};
