/*
 * (C) Copyright HCL Technologies Ltd. 2018, 2019
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

/*
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * ATTENTION!!! If you make changes to this file that affect the generated code,
 * be sure to update the hash generation function at the end of the file.
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 */

const Template = require("webpack/lib/Template");
const ChunkGroup = require("webpack/lib/ChunkGroup");
const {connectChunkGroupAndChunk} = require("webpack/lib/GraphHelpers");
const I18nExtractorItemDependency = require("./I18nExtractorItemDependency");
const runtime = require("./I18nExtractorPlugin.runtime");
const {tap, callSync, callSyncWaterfall} = require("webpack-plugin-compat").for("webpack-i18n-extractor-plugin");

const BLOCK_COMMENT = "/* i18n extractor */";
const CHUNK_REASON = "language extraction";
const localeBundleRegex = /(^.*?[/\\]nls[/\\])([a-zA-z_-]+)[/\\]([^/\\]+)$/;

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
      if (containerChunk === containedChunk || containerChunk.getNumberOfModules() < containedChunk.getNumberOfModules() || containerChunk.getNumberOfGroups() === 0) {
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

    tap(compiler, "compilation", (compilation, params) => {
      compilation.dependencyFactories.set(I18nExtractorItemDependency, params.normalModuleFactory);
      compilation.dependencyTemplates.set(I18nExtractorItemDependency, new I18nExtractorItemDependency.Template());

      tap(compilation, "after-optimize-tree", () =>{
        // For each chunk, move all the non-default nls files to language specific chunks
        const langChunks = [];
        compilation.chunks.forEach((chunk) => {
          if (options.excludeChunks && chunk.name && options.excludeChunks.indexOf(chunk.name) !== -1) {
            return; // ignore this chunk
          }
          chunk.languages = {};
          const langModules = [];
          for(const module of chunk.modulesIterable) {
            const match = module.request && localeBundleRegex.exec(module.request.split('!').pop().split('?').shift());
            if (match && match[2] && match[2] !== 'root') {
              const issuerReq = module.issuer && module.issuer.request && module.issuer.request.split('!').pop().split('?').shift();
              if (issuerReq === match[1] + match[3]) {
                langModules.push({module: module, match: match});
              }
            }
          }
          langModules.forEach(entry => {
            // get only the language part of the locale
            var lang = entry.match[2].match("^[^-]*")[0];
            if (lang) {
              if (options.map) {
                lang = options.map[lang] || lang;
              }
              var langChunk = chunk.languages[lang] && chunk.languages[lang].values().next().value;
              if (!langChunk) {
                // chunk for the language doesn't exist yet.  Create it
                const name = chunk.name && (`${chunk.name}_nls-${lang}`) || undefined;
                langChunk = compilation.addChunk(name);
                langChunk.lang = lang;
                langChunk.chunkReason = CHUNK_REASON;
                chunk.languages[lang] = new Set();
                chunk.languages[lang].add(langChunk);
                langChunks.push(langChunk);
                if (chunk.hasEntryModule() && options.output.filename) {
                  langChunk.filenameTemplate = options.output.filename;
                } else if (!chunk.hasEntryModule() && options.output.chunkFilename) {
                  langChunk.filenameTemplate = options.output.chunkFilename;
                }
                const chunkGroup = new ChunkGroup(name && `${name} - ${CHUNK_REASON}`);
                langChunk.addGroup(chunkGroup);
                connectChunkGroupAndChunk(chunkGroup, chunk);
              }
              // Move the module
              chunk.moveModule(entry.module, langChunk);
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
                  compilation.chunkGroups.forEach(chunkGroup => {
                    if (chunkGroup.name && chunkGroup.name.indexOf(CHUNK_REASON) !== -1) {
                      chunkGroup.replaceChunk(chunk, langChunk);
                    }
                  });
                  compilation.chunks.forEach(c => {
                    const lang = langChunk.lang;
                    if (c.languages && c.languages[lang]) {
                      if (c.languages[lang].has(chunk)) {
                        c.languages[lang].delete(chunk);
                        c.languages[lang].add(langChunk);
                      }
                    }
                  });
                  toRemove.push(chunk);
                } else {
                  // chunk is a subset of the modules contained in langChunk
                  // remove chunk's modules from langChunk and update the chunk groups
                  // that depend on langChunk to load both chunk and langChunk
                  for(const module of chunk.modulesIterable) {
                    langChunk.removeModule(module);
                  }
                  compilation.chunkGroups.forEach(chunkGroup => {
                    if (chunkGroup.chunks.includes(langChunk)) {
                      chunkGroup.pushChunk(chunk);
                    }
                  });
                  const lang = langChunk.lang;
                  compilation.chunks.forEach(c => {
                    if (c.languages && c.languages[lang]) {
                      if (c.languages[lang].has(langChunk))
                      c.languages[lang].add(chunk);
                    }
                  });
                }
              }
            }
          });
        });
        toRemove.forEach((chunk) => {
          chunk.remove("i18n consolidation");
          compilation.chunks.splice(compilation.chunks.indexOf(chunk), 1);
        });
      });

      function mapLanguageChunkNames(data) {
        return compilation.chunks.filter((chunk) => {
          return chunk.chunkReason === CHUNK_REASON && chunk.lang && chunk.filenameTemplate;
        }).reduce((a, chunk) => {
          a[chunk.id] = callSyncWaterfall(compilation.mainTemplate, "asset-path", chunk.filenameTemplate, {
            chunk: chunk,
            hash: data.hash || compilation.hash,
            noChunkHash: false
          });
          return a;
        }, {});
      }

      tap(compilation.mainTemplate, "require", (source) => {
        return Template.asString([
          'if (moduleId === "$$NoModule$$") return;',
          source
        ]);
      });

      tap(compilation.mainTemplate, "require-extensions", function(source, chunk) {
        if(chunk.getNumberOfGroups() === 0) return source;
        const sortedLangs = Object.keys(compilation.chunks.reduce((a, c) => {
          return Object.assign(a, c.languages || {});
        }, {})).sort();
        const map = compilation.chunks.reduce((a1, c) => {
          const chunkIds = Object.keys(c.languages || {}).reduce((a2, lang) => {
            const elem = c.languages[lang];
            a2[sortedLangs.indexOf(lang)] = elem.size > 1 ? Array.from(elem).map(o => o.id) : elem.values().next().value.id;
            return a2;
          }, []);
          if (chunkIds.length) {
            a1[`${c.id}`] = chunkIds;
          }
          return a1;
        }, {});

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
        buf.push(runtime.loadLanguageChunks.toString()
            .replace("__chunk_map__", JSON.stringify(map))
            .replace("__languages__", JSON.stringify(sortedLangs)));
        return Template.asString(buf);
      });

      tap(compilation.mainTemplate, "startup", function(source, chunk) {
        if(chunk.getNumberOfGroups() === 0 || options.noLoadEntryChunkResources) return source;
        const buf = [];
        if (options.promisePolyfill) {
          // Make sure Promise polyfill is initialized first if it is included in the entry chunk
          const promisePath = require.resolve(options.promisePolyfill);
          const promiseMod = promisePath && compilation.modules.find(module => module.request && module.request.split('!').pop().split('?').shift() === promisePath);
          if (promiseMod && chunk.containsModule(promiseMod)) {
            buf.push(`__webpack_require__(${promiseMod.id} /* ${promisePath} */); ${BLOCK_COMMENT}`);
          } else {
            callSync(compiler, 'failed', new Error(`Error referencing promise polyfill: ${promisePath}`));
          }
        }
        buf.push(`var langPromises = loadLanguageChunks(${JSON.stringify(chunk.id)});  ${BLOCK_COMMENT}`);
        buf.push(`function startupFn() {  ${BLOCK_COMMENT}`);
        buf.push(Template.indent(source));
        buf.push(`}  ${BLOCK_COMMENT}`);
        buf.push(`return (langPromises.length) ? Promise.all(langPromises).then(startupFn) : startupFn();  ${BLOCK_COMMENT}`);
        return Template.asString(buf);
      });

      tap(compilation.mainTemplate, "require-ensure", function(source, chunk) {
        // Emit code to load the language specific nls chunk in addition to the requested chunk
        const buf = [];
        // Return a promise that resolves when the requested chunk and the associated language chunks have been
        // loaded.
        buf.push(Template.indent(`if (chunkId === ${JSON.stringify(chunk.id)}) return Promise.resolve();  ${BLOCK_COMMENT}`));
        buf.push(source);
        buf.push(`promises = promises.concat(  ${BLOCK_COMMENT}`);
        buf.push(Template.indent(`loadLanguageChunks(chunkId)  ${BLOCK_COMMENT}`));
        buf.push(`);  ${BLOCK_COMMENT}`);
        return Template.asString(buf);
      });

      tap(compilation, 'succeed-module', module => {
        function processDeps(depBlock) {
          (depBlock.dependencies||[]).forEach((dep, i) => {
            const req = dep.request && dep.request.split('!').pop().split('?').shift().replace(/[/\\]/g, '/');
            const match = localeBundleRegex.exec(req);
            if (match) {
              const moduleReq = module.request.split('!').pop().split('?').shift().replace(/[/\\]/g,'/');
              if (moduleReq === (match[1] + match[3])) {
                const newDep = new I18nExtractorItemDependency(dep.request, dep.range, module);
                newDep.loc = dep.loc;
                newDep.optional = dep.optional;
                depBlock.dependencies.splice(i, 1, newDep);
              }
            }
          });
          (depBlock.blocks||[]).forEach(processDeps);
          (depBlock.variables||[]).forEach(processDeps);
        }
        processDeps(module);
      });

      tap(compilation.mainTemplate, "asset-path", (filename, data) => {
        if (data.chunk && data.chunk.chunkReason === CHUNK_REASON && data.chunk.lang) {
          let parentName = '', parentGroupName = '', parentId = '';
          let chunkGroup = data.chunk.groupsIterable.values().next().value;
          const parentChunk = chunkGroup && chunkGroup.chunks[0];

          if (parentChunk) {
            const parentGroup = parentChunk.groupsIterable.values().next().value;
            if (parentGroup && parentGroup.options.name) {
              parentGroupName = parentGroup.options.name;
            }
            parentName = parentChunk.name;
            parentId = parentChunk.id;
          }
          filename = filename
            .replace(/\[parentgroupname\]/, parentGroupName)
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

      tap(compilation.mainTemplate, "hash", (hash) => {
        hash.update("webpack-i18n-extractor-plugin");
        hash.update("9");   // Increment this whenever the render code above changes
      });
    });
  }
};
