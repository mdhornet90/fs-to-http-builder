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
  // const test = getAllFilesFromRoot(rootPath).filter(
  //   aPath =>
  //     !mm.any(aPath, exclusionPatterns) && mm.isMatch(aPath, inclusionPattern),
  // );
  return findAllEndpointsDirectories(rootPath).reduce((acc, folder) => {
    const potentialRoutes = discoverPotentialPathsToRoutes(folder, options);
    return [...acc, ...extractValidRoutes(folder, potentialRoutes, options)];
  }, []);
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
      paths.push(current);
    }
  }
  return paths;
}

function findAllEndpointsDirectories(root) {
  const paths = [];
  let remainingFiles = [root];
  while (remainingFiles.length > 0) {
    const current = remainingFiles.pop();
    const { name } = path.parse(current);
    const status = fs.statSync(current);
    if (status.isDirectory()) {
      if (name === 'endpoints') {
        paths.push(current);
      } else {
        const subFiles = fs
          .readdirSync(current)
          .map(file => path.join(current, file));
        remainingFiles = [...subFiles, ...remainingFiles];
      }
    }
  }
  return paths;
}

function discoverPotentialPathsToRoutes(root, { exclusionPatterns }) {
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
    } else if (!mm.any(current, exclusionPatterns)) {
      paths.push(current);
    }
  }
  return paths;
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
    .split(path.sep)
    .map(elem => (elem.startsWith('_') ? `:${elem.slice(1)}` : elem))
    .join(path.sep);
  const { dir, name } = path.parse(sanitizedPath);
  const route = dir.split(path.sep).join('/');
  return { name, route };
}

function buildEndpointRoute(route, name) {
  const routeElements = [route];
  if (name !== 'index') {
    routeElements.push(name);
  }

  return `/${route ? routeElements.join('/') : name}`;
}
