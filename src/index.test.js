import Fsify from 'fsify';

import routeBuilder from '.';

const TESTING_DIRECTORY = `${process.cwd()}/unit-testing`;
const harnessFsify = Fsify({ persistent: false, force: true });
const fsify = Fsify({ cwd: TESTING_DIRECTORY, persistent: false, force: true });

expect.extend({
  toMatchFunction(receivedFn, expectedFnContents) {
    const pass = receivedFn.toString() === expectedFnContents;
    return {
      message: () =>
        `expected ${receivedFn.toString()} ${
          pass ? 'not ' : ''
        }to match ${expectedFnContents}`,
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
      expect(routeBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from directories that do not contain an "endpoints" folder', async () => {
      await fsify(
        translateDirectoryStructure({ 'someFolder/thisFile': 'isUseless' }),
      );
      expect(routeBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder will not generate routes from an empty "endpoints" directory', async () => {
      await fsify(translateDirectoryStructure({ 'someFolder/endpoints': {} }));
      expect(routeBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test folders', async () => {
      await fsify(
        translateDirectoryStructure({
          'someFolder/__tests__/this/endpoints/folder/will/be': 'skipped',
        }),
      );
      expect(routeBuilder(TESTING_DIRECTORY)).toEqual([]);
    });

    test('The builder by default will skip test files', async () => {
      await fsify(
        translateDirectoryStructure({
          someFolder: {
            api: { endpoints: { 'something.test.js': 'file here' } },
          },
        }),
      );
      expect(routeBuilder(TESTING_DIRECTORY)).toEqual([]);
    });
  });
  describe('Route Extraction Tests', () => {
    ['post', 'get', 'put', 'patch', 'delete'].forEach(method => {
      test(`The builder will generate route information for any files whose name matches "${method}"`, async () => {
        await fsify(
          translateDirectoryStructure({
            [`someFolder/api/endpoints/foo/bar/${method}.js`]: 'module.exports = { default: () => {} }',
          }),
        );

        expect(routeBuilder(TESTING_DIRECTORY)).toMatchObject([
          {
            method,
            route: '/foo/bar',
            handlingFunction: expect.any(Function),
          },
        ]);
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
    const nextDirectory = hasOneComponent
      ? contents
      : { [rest.join('/')]: contents };
    return {
      type: Fsify.DIRECTORY,
      name: first,
      contents: translateDirectoryStructure(nextDirectory),
    };
  });
}
