'use strict';

// External protocols regex, supports:
// "http", "https", "//" and "www."
var REGEX_EXTERNAL_PROTOCOLS = /^https?:\/\/|\/\/|www\./;


/**
 * Creates an instance of URLBuilder class.
 *
 * @constructor
 * @param {object} - instance of {@link ConfigParser} object.
 */
function URLBuilder(configParser) {
    this._configParser = configParser;
}

URLBuilder.prototype = {
    constructor: URLBuilder,

    /**
     * Returns a list of URLs from provided list of modules.
     *
     * @param {array} modules List of modules for which URLs should be created.
     * @return {array} List of URLs.
     */
    build: function (modules) {
        var bufferAbsoluteURL = [];
        var bufferRelativeURL = [];
        var modulesAbsoluteURL = [];
        var modulesRelativeURL = [];
        var absoluteIndex = 0;
        var relativeIndex = 0;
        var result = [];

        var config = this._configParser.getConfig();

        var basePath = config.basePath || '';
        var registeredModules = this._configParser.getModules();

        /* istanbul ignore else */
        if (basePath.length && basePath.charAt(basePath.length - 1) !== '/') {
            basePath += '/';
        }

        for (var i = 0; i < modules.length; i++) {
            var module = registeredModules[modules[i]];

            // If module has fullPath, individual URL have to be created.
            if (module.fullPath) {
                result.push({
                    modules: [module.name],
                    url: module.fullPath
                });

            } else {
                var path = this._getModulePath(module);
                var absolutePath = path.indexOf('/') === 0;

                // If the URL starts with external protocol, individual URL shall be created.
                if (REGEX_EXTERNAL_PROTOCOLS.test(path)) {
                    result.push({
                        modules: [module.name],
                        url: path
                    });

                // If combine is disabled, or the module is anonymous one,
                // create individual URL based on config URL and module path.
                // If the module path starts with "/", do not include basePath in the URL.
                } else if (!config.combine || module.anonymous) {
                    result.push({
                        modules: [module.name],
                        url: config.url + (absolutePath ? '' : basePath) + path
                    });

                } else {
                    // If combine is true, this is not anonymous module and the module does not have full path,
                    // it will be collected in a buffer to be loaded among with other modules from combo loader.
                    // We will put the path in different buffer depending on the fact if it is absolute URL or not.
                    if (absolutePath) {
                        bufferAbsoluteURL.push(path);
                        modulesAbsoluteURL.push(module.name);
                    } else {
                        if (bufferRelativeURL[relativeIndex]) {
                            if ((bufferRelativeURL[relativeIndex].url.length + basePath.length + path.length) <= config.limitCharacters) {
                                bufferRelativeURL[relativeIndex].url = bufferRelativeURL[relativeIndex].url + '&' + basePath + path;
                                bufferRelativeURL[relativeIndex].modules.push(module.name);
                            } else {
                                relativeIndex++;
                            }
                        }
                        if (!bufferRelativeURL[relativeIndex]) {
                            bufferRelativeURL[relativeIndex] = {
                                modules: [module.name],
                                url: config.url + basePath + path
                            };
                        }
                    }
                }
            }

            module.requested = true;
        }

        //Add to the result all modules, which have to be combined.
        if (bufferRelativeURL.length) {
            result = result.concat(bufferRelativeURL);
            bufferRelativeURL.length = 0;
        }

        if (bufferAbsoluteURL.length) {
            result.push({
                modules: modulesAbsoluteURL,
                url: config.url + bufferAbsoluteURL.join('&')
            });
            bufferAbsoluteURL.length = 0;
        }

        return result;
    },

    /**
     * Returns the path for a module. If module has property path, it will be returned directly. Otherwise,
     * the name of module will be used and extension .js will be added to module name if omitted.
     *
     * @protected
     * @param {object} module The module which path should be returned.
     * @return {string} Module path.
     */
    _getModulePath: function (module) {
        var path = module.path || module.name;

        var paths = this._configParser.getConfig().paths || {};

        var found = false;
        Object.keys(paths).forEach(function(item) {
            /* istanbul ignore else */
            if (path === item || path.indexOf(item + '/') === 0) {
                path = paths[item] + path.substring(item.length);
            }
        });

        /* istanbul ignore else */
        if(!found && typeof paths['*'] === 'function') {
            path = paths['*'](path);
        }

        if (!REGEX_EXTERNAL_PROTOCOLS.test(path) && path.indexOf('.js') !== path.length - 3) {
            path += '.js';
        }

        return path;
    }
};