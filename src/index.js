import { promises as fs } from 'fs';
import path from 'path';

import Debug from 'debug';
import mm from 'micromatch';

const debug = Debug('fs-to-http-builder');

export default async (
  rootPath,
  {
    httpMethods = ['post', 'get', 'put', 'patch', 'delete'],
    fileExclusionPatterns = [
      '**/__tests__/**/*.[jt]s?(x)',
      '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    fileInclusionPattern = '**/endpoints/**/*[jt]s?(x)',
  } = {},
) => {
  const filesFromRoot = await getAllFilesFromRoot(rootPath);
  const endpointPaths = filesFromRoot.filter(aPath => {
    const result =
      !mm.any(aPath, fileExclusionPatterns, { dot: true }) &&
      mm.isMatch(aPath, fileInclusionPattern, { dot: true });
    debug(`Is path ${aPath} a match for an endpoint? ${result ? 'Yes' : 'No'}`);
    return result;
  });
  const endpointFileGroups = groupFilesByEndpointDirectories(endpointPaths);
  return Object.keys(endpointFileGroups).reduce(
    (acc, folder) => [
      ...acc,
      ...extractValidRoutes(folder, endpointFileGroups[folder], {
        httpMethods,
      }),
    ],
    [],
  );
};

async function getAllFilesFromRoot(root) {
  const paths = [];
  let remainingFiles = [root];
  while (remainingFiles.length > 0) {
    const current = remainingFiles.pop();
    // eslint-disable-next-line no-await-in-loop
    const status = await fs.stat(current);
    if (status.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      const directoryContents = await fs.readdir(current);
      const subFiles = directoryContents.map(file => path.join(current, file));
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

function extractValidRoutes(root, pathsToPotentialRoutes, { httpMethods }) {
  return pathsToPotentialRoutes.reduce((acc, pathToRoute) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const loadedModule = require(pathToRoute);
    const { name, route } = extractRoute(root, pathToRoute);
    const moduleExports = Object.keys(loadedModule);
    if (httpMethods.includes(name)) {
      debug(`Adding route with the name of http method ${name}: ${route}`);
      acc.push({
        method: name,
        route: `/${route}`,
        handler: loadedModule.default,
      });
    } else if (moduleExports.some(e => httpMethods.includes(e))) {
      debug(`Extracting http methods from file ${name}`);
      acc.push(
        ...moduleExports
          .filter(exportName => {
            const result = httpMethods.includes(exportName);
            if (!result) {
              debug(`  Skipping non-HTTP-method export ${exportName}`);
            }
            return result;
          })
          .map(exportName => {
            const finalizedRoute = buildEndpointRoute(route, name);
            debug(`  Adding route with the name of http method ${name}`);
            return {
              method: exportName,
              route: finalizedRoute,
              handler: loadedModule[exportName],
            };
          }),
      );
    }
    return acc;
  }, []);
}

function extractRoute(root, pathToRoute) {
  const sanitizedPath = path
    .relative(root, pathToRoute)
    .split('/')
    .map(elem => (elem.startsWith('_') ? `:${elem.slice(1)}` : elem))
    .join('/');
  const { name, dir } = path.parse(sanitizedPath);
  return { name, route: dir };
}

function buildEndpointRoute(route, name) {
  const routeElements = route ? [route] : [];
  if (name !== 'index') {
    routeElements.push(name);
  } else {
    debug(
      `Found index file, using name of enclosing folder (${
        routeElements[routeElements.length - 1]
      })`,
    );
  }
  return `/${routeElements.join('/')}`;
}
