import Fsify from 'fsify';

import fsToHttpBuilder from '.';

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
      expect(fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from directories that do not contain an "endpoints" folder', async () => {
      await fsify(translateDirectoryStructure({ 'someFolder/thisFile': 'isUseless' }));
      expect(fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from an empty "endpoints" directory', async () => {
      await fsify(translateDirectoryStructure({ 'someFolder/endpoints': {} }));
      expect(fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test folders', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/__tests__/this/endpoints/folder/will/be/skipped.js':
            'module.exports = { get: () => {}, post: () => {} }',
        }),
      );
      expect(fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test files', async () => {
      await fsify(
        translateDirectoryStructure({
          someFolder: {
            api: { endpoints: { 'something.test.js': 'file here' } },
          },
        }),
      );
      expect(fsToHttpBuilder(TESTING_DIRECTORY)).toEqual([]);
    });
  });
  describe('Route Extraction Tests', () => {
    ['post', 'get', 'put', 'patch', 'delete'].forEach(method => {
      test(`The builder will generate route information for any files whose name matches "${method}"`, async () => {
        await fsify(
          translateDirectoryStructure({
            'someFolder/api/endpoints': {
              'users.js': 'module.exports = { get: () => {} }',
              'foo/bar': {
                [`${method}.js`]: 'module.exports = { default: () => {} }',
                'thiswontmatch.js': 'module.exports = { default: () => {} }',
              },
            },
          }),
        );

        const routes = fsToHttpBuilder(TESTING_DIRECTORY);
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
            'baz.js': 'module.exports = { get: () => {}, post: () => {}, blah: () => {} }',
            'thiswontmatch.js': 'module.exports = { default: () => {} }',
            'anothernonmatch.js': 'module.exports = { blah: () => {}, foo: () => {} }',
          },
        }),
      );

      const routes = fsToHttpBuilder(TESTING_DIRECTORY);
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
            'index.js': 'module.exports = { get: () => {}, post: () => {} }',
            'thiswontmatch.js': 'module.exports = { default: () => {} }',
          },
        }),
      );

      const routes = fsToHttpBuilder(TESTING_DIRECTORY);
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
            'index.js': 'module.exports = { get: () => {}, post: () => {} }',
            'thiswontmatch.js': 'module.exports = { default: () => {} }',
          },
        }),
      );

      const routes = fsToHttpBuilder(TESTING_DIRECTORY);
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
