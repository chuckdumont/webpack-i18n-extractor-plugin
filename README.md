# webpack-i18n-extractor-plugin

This plugin extracts NLS resources from the application chunks and places them in language/chunk specific language chunks.  There will be *n* language chunks for each application chunk, where *n* is the number of languages supported by the application.  Resources belonging to the default, or `root` locale are not extracted and remain in the application chunks.

NLS resourses are identified by their source paths.  Javascript files residing in an `nls`  directory are considered to be NLS resources and will be extracted, unless they belong to the default locale.  Files residing at the root of an `nls` directory (e.g. `./nls/strings.js`), or in a subdirectory named `root` (e.g. `./nls/root/strings.js`) belong to the default locale.  Files residing in a subdirectory named after a locale (e.g. `./nls/en-us/strings.js`) belong to the self named locale.  The language portion of the locale name identifies the language chunk that the resource will reside in.  All locales for a given language (except the default locale) will reside within the same language chunk.

When an application chunk is loaded, the associated language chunk matching the user's locale will be automatically loaded at the same time if necessary (i.e. if the current locale
is not the default locale).  This goes for entry chunks as well, unless the [noLoadEntryChunkResources](#noloadentrychunkresources) option is true.

## Install

```bash
npm i -D webpack-i18n-extractor-plugin
```

## Usage

```javascript
// webpack.config.js
var WebpackI18nExtractorPlugin = require('webpack-i18n-extractor-plugin');

module.exports = {
  // ... snip ...
  plugins: [
    new WebpackI18nExtractorPlugin({
			output: {
				filename: '[parentname]_nls-[lang].js',
				chunkFilename: '[parentid]_nls-[lang].js'
			}
		})
  ],
  // ... snip ...
}
```

## Options

#### map

Properties map of language groupings.  Can be used to combine nls resource for different languages into the same chunk.  For example, `map: {nb:'no'}` will place resources for the `nb` language into the same chunk as resources for the `no` language.  This is useful when a vendor library uses a different locale name than the application for a given language.

#### getUserLocale

A function that executes in the browser client and returns the user's locale.  If not provided, or the function returns null or undefined, then the locale will be determined by examining the browser's `navigator.languages`, `navigator.language` and `navigator.userLanguage` properties.

#### excludeChunks

Array of chunk names to exclude.  The specified chunks will not have their nls resource extracted.

#### noLoadEntryChunkResources

If true, nls resources for entry chunks will not be automatically loaded.  The app will be responsible for loading both the entry chunk and the nls resource(s) for the entry chunk, and for ensuring that the nls resource(s) are loaded before being referenced by the app.  This can help reduce load-time by loading the entry chunk and the nls resource(s) in parallel rather than in sequence, but places more burden on the app to handle loading and synchronization of multiple script files.

#### output.filename

Filename template used if the parent chunk (the chunk that the resources were extracted from) is an entry chunk.  You may use the replacement parameters `[parentname]`, `[parentid]`, and `[lang]` in addition to those honored by the wepback `output.filename` option.  For example, the template string `[parentname]_nls-[lang].js` will produce language chunks named `main_nls-en.js`, `main_nls-es.js`, `main_nls-fr.js`, etc. for language chunks extracted from the main chunk.

#### output.chunkFilename

Filename template used if the parent chunk is not an entry chunk.  You may use the replacement parameters `[parentname]`, `[parentid]` and `[lang` in addition to those honored by the webpack `output.chunkFilename` option.

## Language chunk considation

The plugin will attempt to consolidate language chunks and eliminate duplication of resources.  For example, if chunk B's nls resources are a subset of chunk A's nls resources, then the plugin will remove the nls resources that chunk A and chunk B have in common from chunk A's language chunks and load both the chunk A and chunk B language chunks for the selected language when chunk A is loaded.
