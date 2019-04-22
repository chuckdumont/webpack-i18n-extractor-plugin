# webpack-i18n-extractor-plugin

This version of the plugin supports Webpac 4.  For Webpack 3, use the 1.x version of the plugin.  It is for use with Dojo 1.x applications that have been built with webpack using the [dojo-webpack-plugin](https://github.com/OpenNTF/dojo-webpack-plugin).

This plugin extracts NLS resources from the application chunks and places them in language/chunk specific resource bundles that are automatically loaded as needed for the current locale.  There will be *n* resource bundles for each application chunk, where *n* is the number of languages supported by the application.  Resources belonging to the default, or `root` locale are not extracted and remain in the application chunks.

NLS resources are identified by their source paths.  JavaScript files residing in an `nls`  directory are considered to be NLS resources and will be extracted, unless they belong to the default locale.  Files residing at the root of an `nls` directory (e.g. `./nls/strings.js`), or in a subdirectory named `root` (e.g. `./nls/root/strings.js`) belong to the default locale.  Files residing in a subdirectory named after a locale (e.g. `./nls/en-us/strings.js`) belong to the self named locale.  The language portion of the locale name identifies the resource bundle that the resource will reside in.  All locales for a given language (except the default locale) will reside within the same resource bundle.

When an application chunk is loaded, the associated resource bundle matching the user's locale will be automatically loaded at the same time if necessary (i.e. if the current locale
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

#### promisePolyfill

The name of the module that provides an ES6 Promise polyfill.  This is needed if you wish to support browsers that lack ES6 promise support (e.g. IE11).  Note that specifying this option does **not** automatically add the dependency for the module to your application.  You still need to do that by explicitily requiring the module within your applicaition, or by using the [imports-loader](https://www.npmjs.com/package/imports-loader) or the [ProvidePlugin](https://webpack.js.org/plugins/provide-plugin/).  This option is needed because the plugin needs to be able to initialize the polyfill independently, and ahead of, the entry module.

The polyfill module must be self-initializing.

#### output.filename

Filename template used if the parent chunk (the chunk that the resources were extracted from) is an entry chunk.  You may use the replacement parameters `[parentgroupname]`, `[parentname]`, `[parentid]`, and `[lang]` in addition to those honored by the wepback `output.filename` option.  For example, the template string `[parentname]_nls-[lang].js` will produce resource bundles named `main_nls-en.js`, `main_nls-es.js`, `main_nls-fr.js`, etc. for resource bundles extracted from the main chunk.  The `[parentgroupname]` replacement parameter may be preferable over `[parentname]` when chunk splitting mangles the chunk names.

#### output.chunkFilename

Filename template used if the parent chunk is not an entry chunk.  You may use the replacement parameters `[parentgroupname]`, `[parentname]`, `[parentid]` and `[lang` in addition to those honored by the webpack `output.chunkFilename` option.

## Resource considation

The plugin will attempt to consolidate resource bundles and eliminate duplication of resources.  For example, if chunk B's nls resources are a subset of chunk A's nls resources, then the plugin will remove the nls resources that chunk A and chunk B have in common from chunk A's resource bundles and load both the chunk A and chunk B resource bundles for the selected language when chunk A is loaded.
