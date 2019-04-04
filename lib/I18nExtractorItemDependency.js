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
 const ModuleDependency = require("webpack/lib/dependencies/ModuleDependency");
 const {version} = require("../package.json");

 class I18nExtractorItemDependency extends ModuleDependency {
  constructor(request, range) {
    super(request);
    this.range = range;
  }
}

I18nExtractorItemDependency.prototype.type = "i18n extractor";

I18nExtractorItemDependency.Template = class I18nExtractorItemDependencyTemplate {
  apply(dep, source) {
    if(!dep.range) return;
    source.replace(dep.range[0], dep.range[1]-1, `'$$NoModule$$' /* ${dep.module.request} dependency removed by I18nExtractorPlugin */`);
  }

  applyAsTemplateArgument(name__, dep, source) {
    return this.apply(dep, source);
  }
};

I18nExtractorItemDependency.version = version;

module.exports = I18nExtractorItemDependency;
