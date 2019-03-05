import fs from 'fs';
import path from 'path';

import mm from 'micromatch';

export default (
  rootPath,
  {
    httpMethods = ['post', 'get', 'put', 'patch', 'delete'],
    exclusionPatterns = [
      '**/__tests__/**/*.[jt]s?(x)',
      '**/?(*.)+(spec|test).[jt]s?(x)',
    ],
    inclusionPattern = '**/endpoints/**/*[jt]s?(x)',
  } = {},
) => {
  const options = { httpMethods, exclusionPatterns };
  const endpointPaths = getAllFilesFromRoot(rootPath).filter(
    aPath =>
      !mm.any(aPath, exclusionPatterns) && mm.isMatch(aPath, inclusionPattern),
  );
  const endpointFileGroups = groupFilesByEndpointDirectories(endpointPaths);
  return Object.keys(endpointFileGroups).reduce(
    (acc, folder) => [
      ...acc,
      ...extractValidRoutes(folder, endpointFileGroups[folder], options),
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
      const subFiles = fs
        .readdirSync(current)
        .map(file => path.join(current, file));
      remainingFiles = [...subFiles, ...remainingFiles];
    } else {
      paths.push(current.split(path.sep).join('/'));
    }
  }
  return paths;
}

function groupFilesByEndpointDirectories(paths) {
  const groups = paths.reduce((acc, aPath) => {
    const components = aPath.split('/');
    const { length } = components;
    let i = 0;
    const endpointDirComponents = [];
    while (i < length) {
      endpointDirComponents.push(components[i]);
      i += 1;
      if (components[i - 1] === 'endpoints') {
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
      acc.push({
        method: name,
        route: `/${route}`,
        handlingFunction: loadedModule.default,
      });
    } else if (moduleExports.every(e => httpMethods.includes(e))) {
      acc.push(
        ...moduleExports.map(exportName => ({
          method: exportName,
          route: buildEndpointRoute(route, name),
          handlingFunction: loadedModule[exportName],
        })),
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
  const { dir, name } = path.parse(sanitizedPath);
  return { name, route: dir };
}

function buildEndpointRoute(route, name) {
  const routeElements = route ? [route] : [];
  if (name !== 'index') {
    routeElements.push(name);
  }
  return `/${routeElements.join('/')}`;
}
