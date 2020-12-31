import Fsify from 'fsify';

import fsToHttpBuilder from './index';

const TESTING_DIRECTORY = `${process.cwd()}/unit-testing`;
const harnessFsify = Fsify({ persistent: false, force: true });
const fsify = Fsify({ cwd: TESTING_DIRECTORY, persistent: false, force: true });

expect.extend({
  toMatchFunction(receivedFn, expectedFnContents) {
    const pass = receivedFn.toString() === expectedFnContents;
    return {
      message: () => `expected ${receivedFn.toString()} ${pass ? 'not ' : ''}to match ${expectedFnContents}`,
      pass,
    };
  },
});

describe('Route Builder Tests', () => {
  beforeAll(async () => {
    await harnessFsify([{ type: fsify.DIRECTORY, name: 'unit-testing' }]);
  });

  afterEach(async () => {
    await fsify.cleanup();
  });

  afterAll(async () => {
    await harnessFsify.cleanup();
  });

  describe('Endpoint Discovery Tests', () => {
    test('The builder will not generate routes from empty directories', async () => {
      await fsify(translateDirectoryStructure({}));
      expect(await fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from directories that do not contain an "endpoints" folder', async () => {
      await fsify(translateDirectoryStructure({ 'someFolder/thisFile': 'isUseless' }));
      expect(await fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from an empty "endpoints" directory', async () => {
      await fsify(translateDirectoryStructure({ 'someFolder/endpoints': {} }));
      expect(await fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test folders', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/__tests__/this/endpoints/folder/will/be/skipped.mjs':
            'export const get = () => {}; export const post = () => {}',
        }),
      );
      expect(await fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test files', async () => {
      await fsify(
        translateDirectoryStructure({
          someFolder: {
            api: { endpoints: { 'something.test.mjs': 'file here' } },
          },
        }),
      );
      expect(await fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });
  });
  describe('Route Extraction Tests', () => {
    ['post', 'get', 'put', 'patch', 'delete'].forEach(method => {
      test(`The builder will generate route information for any files whose name matches "${method}"`, async () => {
        await fsify(
          translateDirectoryStructure({
            'someFolder/api/endpoints': {
              'users.mjs': 'export const get = () => {}',
              'foo/bar': {
                [`${method}.mjs`]: 'export default function() {}',
                'thiswontmatch.mjs': 'export default function() {}',
              },
            },
          }),
        );

        const routes = await fsToHttpBuilder(TESTING_DIRECTORY);
        expect(routes).toContainEqual({
          method,
          route: '/foo/bar',
          handler: expect.any(Function),
        });
        expect(routes).toContainEqual({
          method: 'get',
          route: '/users',
          handler: expect.any(Function),
        });
      });
    });

    test('The builder will generate routes from files that contain http methods as exports', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/api/endpoints/foo/bar': {
            'baz.mjs': 'export const get = () => {}; export const post = () => {}; export const blah = () => {}',
            'thiswontmatch.mjs': 'export default function() {}',
            'anothernonmatch.mjs': 'export const blah = () => {}; export const foo = () => {}',
          },
        }),
      );

      const routes = await fsToHttpBuilder(TESTING_DIRECTORY);
      expect(routes).toContainEqual({
        method: 'get',
        route: '/foo/bar/baz',
        handler: expect.any(Function),
      });
      expect(routes).toContainEqual({
        method: 'post',
        route: '/foo/bar/baz',
        handler: expect.any(Function),
      });
    });

    test('The builder can generate routes from index.js using the folder name as the path', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/api/endpoints/foo/bar/baz': {
            'index.mjs': 'export const get =  () => {}; export const post = () => {}',
            'thiswontmatch.mjs': 'export default function() {}',
          },
        }),
      );

      const routes = await fsToHttpBuilder(TESTING_DIRECTORY);
      expect(routes).toContainEqual({
        method: 'get',
        route: '/foo/bar/baz',
        handler: expect.any(Function),
      });
      expect(routes).toContainEqual({
        method: 'post',
        route: '/foo/bar/baz',
        handler: expect.any(Function),
      });
    });

    test('The builder will detect underscore-prefixed folders as route parameters', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/api/endpoints/users/_id/stuff': {
            'index.mjs': 'export const get =  () => {}; export const post = () => {}',
            'thiswontmatch.mjs': 'export default function() {}',
          },
        }),
      );

      const routes = await fsToHttpBuilder(TESTING_DIRECTORY);
      expect(routes).toContainEqual({
        method: 'get',
        route: '/users/:id/stuff',
        handler: expect.any(Function),
      });
      expect(routes).toContainEqual({
        method: 'post',
        route: '/users/:id/stuff',
        handler: expect.any(Function),
      });
    });

    test('The builder accepts custom route matchers to extend functionality', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/api/endpoints/users/_id': {
            'whatever.mjs': 'export default function() {}',
          },
        }),
      );

      const handler = () => true;
      const routes = await fsToHttpBuilder(TESTING_DIRECTORY, {
        customRouteMatchers: [
          {
            testFn() {
              return true;
            },
            extractionFn() {
              return {
                method: 'imadeitup',
                route: 'foo',
                handler,
              };
            },
          },
        ],
      });
      expect(routes).toContainEqual({
        method: 'imadeitup',
        route: 'foo',
        handler,
      });
    });
  });
});

function translateDirectoryStructure(directory) {
  return Object.keys(directory).map(key => {
    const [first, ...rest] = key.split('/');
    const contents = directory[key];
    const hasOneComponent = key === first;
    if (hasOneComponent && typeof contents === 'string') {
      return { type: Fsify.FILE, name: key, contents };
    }
    const nextDirectory = hasOneComponent ? contents : { [rest.join('/')]: contents };
    return {
      type: Fsify.DIRECTORY,
      name: first,
      contents: translateDirectoryStructure(nextDirectory),
    };
  });
}
