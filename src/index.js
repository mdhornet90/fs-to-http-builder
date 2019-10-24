import fs from 'fs';
import path from 'path';

import Debug from 'debug';
import mm from 'micromatch';

const debug = Debug('fs-to-http-builder');

const DEFAULT_VALID_ROUTE_MATCHERS = [
  {
    testFn: ({ routeMetadata: { name }, httpMethods }) => httpMethods.includes(name),
    extractionFn: ({ routeMetadata: { name, route }, loadedModule, debugLogger }) => {
      debugLogger(`Adding route with the name of http method ${name}: ${route}`);
      return {
        method: name,
        route: `/${route}`,
        handler: loadedModule.default,
      };
    },
  },
  {
    testFn: ({ loadedModule, httpMethods }) => Object.keys(loadedModule).some(e => httpMethods.includes(e)),
    extractionFn: ({ loadedModule, routeMetadata: { name, route }, httpMethods, debugLogger }) =>
      Object.keys(loadedModule)
        .filter(exportName => {
          const result = httpMethods.includes(exportName);
          if (!result) {
            debugLogger(`  Skipping non-HTTP-method export ${exportName}`);
          }
          return result;
        })
        .map(exportName => {
          const finalizedRoute = buildEndpointRoute(route, name);
          debugLogger(`  Adding route with the name of http method ${name}`);
          return {
            method: exportName,
            route: finalizedRoute,
            handler: loadedModule[exportName],
          };
        }),
  },
];

export default (
  rootPath,
  {
    httpMethods = ['post', 'get', 'put', 'patch', 'delete'],
    fileExclusionPatterns = ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    fileInclusionPattern = '**/endpoints/**/*[jt]s?(x)',
    customRouteMatchers = [],
  } = {},
) => {
  const endpointPaths = getAllFilesFromRoot(rootPath).filter(aPath => {
    const result =
      !mm.any(aPath, fileExclusionPatterns, { dot: true }) && mm.isMatch(aPath, fileInclusionPattern, { dot: true });
    debug(`Is path ${aPath} a match for an endpoint? ${result ? 'Yes' : 'No'}`);
    return result;
  });
  const endpointFileGroups = groupFilesByEndpointDirectories(endpointPaths);
  return Object.keys(endpointFileGroups).reduce(
    (acc, folder) => [
      ...acc,
      ...extractValidRoutes(
        folder,
        endpointFileGroups[folder],
        [...customRouteMatchers, ...DEFAULT_VALID_ROUTE_MATCHERS],
        { httpMethods },
      ),
    ],
    [],
  );
};

function getAllFilesFromRoot(root) {
  const paths = [];
  let remainingFiles = [root];
  while (remainingFiles.length > 0) {
    const current = remainingFiles.pop();
    const status = fs.statSync(current);
    if (status.isDirectory()) {
      const subFiles = fs.readdirSync(current).map(file => path.join(current, file));
      remainingFiles = [...subFiles, ...remainingFiles];
    } else {
      debug(`Found file: ${current}`);
      paths.push(current.split(path.sep).join('/'));
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

function extractValidRoutes(root, pathsToPotentialRoutes, routerMatcherSuite, { httpMethods }) {
  return pathsToPotentialRoutes.reduce((acc, pathToRoute) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const loadedModule = require(pathToRoute);
    const routeMetadata = extractRoute(root, pathToRoute);
    const match = routerMatcherSuite.find(({ testFn }) =>
      testFn({ loadedModule, routeMetadata, httpMethods, debugLogger: debug }),
    );
    if (match) {
      const extractedRouteHandler = match.extractionFn({
        loadedModule,
        routeMetadata,
        httpMethods,
        debugLogger: debug,
      });
      acc.push(...(Array.isArray(extractedRouteHandler) ? extractedRouteHandler : [extractedRouteHandler]));
    }
    return acc;
  }, []);
}

function extractRoute(root, pathToRoute) {
  const sanitizedPath = path
    .relative(root, pathToRoute)
    .split(path.sep)
    .map(elem => (elem.startsWith('_') ? `:${elem.slice(1)}` : elem))
    .join('/');
  const { name, dir } = path.parse(sanitizedPath);
  return { name, route: dir.replace(path.sep, '/') };
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
