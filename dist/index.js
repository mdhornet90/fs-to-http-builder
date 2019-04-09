"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

var _micromatch = _interopRequireDefault(require("micromatch"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('fs-to-http-builder');

var _default = (rootPath, {
  httpMethods = ['post', 'get', 'put', 'patch', 'delete'],
  fileExclusionPatterns = ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  fileInclusionPattern = '**/endpoints/**/*[jt]s?(x)'
} = {}) => {
  const endpointPaths = getAllFilesFromRoot(rootPath).filter(aPath => {
    const result = !_micromatch.default.any(aPath, fileExclusionPatterns, {
      dot: true
    }) && _micromatch.default.isMatch(aPath, fileInclusionPattern, {
      dot: true
    });

    debug(`Is path ${aPath} a match for an endpoint? ${result ? 'Yes' : 'No'}`);
    return result;
  });
  const endpointFileGroups = groupFilesByEndpointDirectories(endpointPaths);
  return Object.keys(endpointFileGroups).reduce((acc, folder) => [...acc, ...extractValidRoutes(folder, endpointFileGroups[folder], {
    httpMethods
  })], []);
};

exports.default = _default;

function getAllFilesFromRoot(root) {
  const paths = [];
  let remainingFiles = [root];

  while (remainingFiles.length > 0) {
    const current = remainingFiles.pop();

    const status = _fs.default.statSync(current);

    if (status.isDirectory()) {
      const subFiles = _fs.default.readdirSync(current).map(file => _path.default.join(current, file));

      remainingFiles = [...subFiles, ...remainingFiles];
    } else {
      debug(`Found file: ${current}`);
      paths.push(current.split(_path.default.sep).join('/'));
    }
  }

  return paths;
}

function groupFilesByEndpointDirectories(paths) {
  const groups = paths.reduce((acc, aPath) => {
    const components = aPath.split('/');
    const endpointDirComponents = [];

    for (let i = 0; i < components.length; i += 1) {
      endpointDirComponents.push(components[i]);

      if (components[i] === 'endpoints') {
        break;
      }
    }

    const endpointPath = endpointDirComponents.join('/');
    acc[endpointPath] = [...(acc[endpointPath] || []), aPath];
    return acc;
  }, {});
  return groups;
}

function extractValidRoutes(root, pathsToPotentialRoutes, {
  httpMethods
}) {
  return pathsToPotentialRoutes.reduce((acc, pathToRoute) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const loadedModule = require(pathToRoute);

    const {
      name,
      route
    } = extractRoute(root, pathToRoute);
    const moduleExports = Object.keys(loadedModule);

    if (httpMethods.includes(name)) {
      debug(`Adding route with the name of http method ${name}: ${route}`);
      acc.push({
        method: name,
        route: `/${route}`,
        handler: loadedModule.default
      });
    } else if (moduleExports.some(e => httpMethods.includes(e))) {
      debug(`Extracting http methods from file ${name}`);
      acc.push(...moduleExports.filter(exportName => {
        const result = httpMethods.includes(exportName);

        if (!result) {
          debug(`  Skipping non-HTTP-method export ${exportName}`);
        }

        return result;
      }).map(exportName => {
        const finalizedRoute = buildEndpointRoute(route, name);
        debug(`  Adding route with the name of http method ${name}`);
        return {
          method: exportName,
          route: finalizedRoute,
          handler: loadedModule[exportName]
        };
      }));
    }

    return acc;
  }, []);
}

function extractRoute(root, pathToRoute) {
  const sanitizedPath = _path.default.relative(root, pathToRoute).split('/').map(elem => elem.startsWith('_') ? `:${elem.slice(1)}` : elem).join('/');

  const {
    name,
    dir
  } = _path.default.parse(sanitizedPath);

  return {
    name,
    route: dir
  };
}

function buildEndpointRoute(route, name) {
  const routeElements = route ? [route] : [];

  if (name !== 'index') {
    routeElements.push(name);
  } else {
    debug(`Found index file, using name of enclosing folder (${routeElements[routeElements.length - 1]})`);
  }

  return `/${routeElements.join('/')}`;
}