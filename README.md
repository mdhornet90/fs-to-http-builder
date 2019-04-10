[![CircleCI](https://circleci.com/gh/mdhornet90/fs-to-http-builder/tree/master.svg?style=svg)](https://circleci.com/gh/mdhornet90/fs-to-http-builder/tree/master) [![npm version](https://badge.fury.io/js/fs-to-http-builder.svg)](https://badge.fury.io/js/fs-to-http-builder) [![Mutation testing badge](https://badge.stryker-mutator.io/github.com/mdhornet90/fs-to-http-builder/master)](https://stryker-mutator.github.io)

# fs-to-http-builder
A utility that can generate Express routes from your project's filesystem

## Overview
This tool attempts to free you up from having to manually declare routes while still providing you the flexibility to structure your project how you please.

By default, the tool will crawl through your project's filesystem and search for non-test files inside of any folder named "endpoints" (treating "endpoints" as the root path), and create route information for any files or functions inside of files named any of the following: 
- `post`
- `get`
- `put`
- `patch`
- `delete`

This information can then be fed into Express directly.

## For Example,
If you have a folder structure like the following:
```
{
    src: {
        a: {
            endpoints: {
                foo.js (contains function 'get')
            }
        },
        b: {
            endpoints: {
                bar: {
                    post.js
                },
                baz: {
                    _id: {
                        put.js
                        delete.js
                    }
                }
            }
        }
    }
}
```

The tool will generate the following route information:
```
[
    {
        route: '/foo',
        method: 'get',
        handler: 'get()'
    },
    {
        route: '/bar',
        method: 'post',
        handler: 'default()' // from post.js
    },
    {
        route: '/baz/:id',
        method: 'put',
        handler: 'default()' // from put.js
    },
    {
        route: '/baz/:id',
        method: 'delete',
        handler: 'default()' // from delete.js
    }
]
```

## Love it? Hate it? I want to know! (Maybe not the "hate it" part)
This project was inspired by code in a work project and extended to work with a side project of mine so I fully expect that I made assumptions other people would not - I'll attempt to add some of the first issues myself to track what are likely going to be points of pain for new users, but if the tool isn't working as you'd expect feel free to open up an issue on the project's [Issues page](https://github.com/mdhornet90/fs-to-http-builder/issues). 
