# Cachi

Simple and light NodeJS caching tool utilizing Redis for Express or indeed any other application which does not utilize such a framework.

If this is of use to you, please consider starring 🌟 on [GitHub](https://github.com/eddiejibson/cachi) 😀.

### Redis Failure

Worried about utilzing a database for effectively every request and may return errors? Not to worry, whilst Cachi will still emit events for the server to handle, no errors will be returned to the client and instead the next middleware will be invoked - meaning the only bad side effect will be no cached results - only fresh ones you'll have to compute.

### Why would I ever cache anything?

Well, often some requests have quite intensive processes (e.g database lookups or certain other heavy operations) to end up with a result. With caching such a request, the end result will typically be returned to the client with a significant performance increase as only one very quick operation (to the Redis key) must be executed.

## Installation

Installing Cachi is easy to install into an existing project with NPM (or indeed Yarn):

With NPM:

```bash
npm install --save cachi
```

With Yarn:

```bash
yarn add cachi
```

## Express Example

```javascript
const express = require("express"),
  app = express(),
  Cachi = require("cachi"),
  cachi = new Cachi("redis://localhost/0");

//Most simple example:

app.get("/", cachi.check("base"), async (req, res) => {
  //Create the result
  let result = { success: true };
  //Expiry in 1 hour (3600 seconds)
  await cachi.set("base", result, 3600); //Save the result to be cached
  //Return the result
  return res.status(200).json(result);
});

//With status codes:

app.get("/status", cachi.check("status"), async (req, res) => {
  //The result that to be cached
  let result = { weird: Date.now() * 9999 };
  await cachi.set("status", result, 3600); //Save the result to be cached
  return res.status(200).json(result); //Return the result
});

//This example will only return the cached result if certain
//aspects of the request are the same (in this case the ID URL param)

app.get(
  "/:id",
  cachi.check("id", { req: { params: ["id"] } }),
  async (req, res) => {
    let result = { id: req.params.id, weird: Date.now() * 9999 };
    await cachi.set("id", result, 3600, {
      req: { params: { id: req.params.id } },
    });
    return res.status(200).json(result);
  }
);

app.listen(3000, () =>
  console.log(`Example app listening at http://localhost:3000`)
);
```

## Reference

### Constructor

**Returns:** Void

**Express Middleware Specific**: No

`new Cachi(redis = "redis://127.0.0.1/0", opts = {})`

#### Parameters:

`redis`: _String or Object_ Either the Redis database connection URI, connection object (`{host: host, port: port, password: password}`) or an ioredis instance.

`opts`: _Object_ Various associated options to do with how Cachi works. There's only one key being used at the moment:

- `keyName`: _String_ What string should prefix all redis keys? Defaults to `cache` if not set.

### .set()

**Returns:** Promise

**Express Middleware Specific**: No

`cachi.set(name, data, expiry = 3600, criteria = null)`

#### Parameters:

`name`: **Required** _String_ What should this current result be saved as? (typically endpoint name)

`data`: **Required** _Object or String_ What is the returned result to be saved? If using the Express middleware method, passing a string into such will cause the result to be returned to the client via the `.send` method. However, if it's an object, passing an object into such will cause the result to be returned to the client via the `.json` method

`expiry`: _Integer_ How long until this result is discarded? In seconds.

`criteria`: What requirements must be met for this result to be returned (e.g the request body must have a certain value). **IMPORTANT:** If intended use of such is with express values from the request, see the [criteria info](#solution).

### .get()

**Returns:** Promise

**Express Middleware Specific**: No

`cachi.get(name = null, criteria = null)`

#### Parameters:

`name`: **Required** _String_ What result should Cachi try and find to be returned?

`criteria`: What requirements must be met for a specific result to be returned (e.g the request body must have a certain value). **IMPORTANT:** If intended use of such is with express values from the request, see the [criteria info](#criteria).

### .check()

This is effectively the same as `.get()` except you must call it as an Express middleware function and the name is now optional.

**Returns:** Promise

**Express Middleware Specific**: Yes

`cachi.get(name, criteria = null)`

#### Parameters:

`name`: _String_ What result should Cachi try and find to be returned? (typically endpoint name). If not set, the name will be computed by adding the request's `baseUrl` and `path` strings together.

`criteria`: What requirements must be met for a specific result to be returned (e.g the request body must have a certain value). **IMPORTANT:** If intended use of such is with express values from the request, see the [criteria info](#criteria).

## Express "criteria" solution

So, many responses may need a certain criteria to be met based on certain request aspects for the same endpoint.

For example, let's say we had the endpoint `/:id` - whilst every request being made here is technically the same endpoint, the cached response should be specific to the query param - in this case `id` meaning that only if this value is the same in the cached store will it return the same result. Another example - `/books` shouldn't return the same as `/prices` just because it's within the same defined endpoint.

Now that we've got that out of the way, it's time to discuss how you can use certain request parameters provided by Express.

You're more than welcome to define these criterias by directly referencing the values in such an object:

```javascript
let criteria = {
  name: "Edward",
};
```

However, some values perhaps cannot be accessed in the current scope (when defining a middleware function for example). Take this example:

```javascript
app.get("/:id", cachi.check("base", { id: req.params.id }), (req, res) => {
  return res.status(200).json(result);
});
```

Sadly, you may not be able to access these variables in the current scope - in this case the `req` object.

### Solution

We've devised something that should fix the issue.

As our middleware can access these variables, you can leave the key names you want the criteria to be filled with.

And it must be done like so:

```javascript
cachi.check("base", { req: { params: ["id"] })
```

You **must** make these requirements within the `req` key. The names within such should be obvious e.g `params` is obviously referring to the `req.params`. Next to such is an array - as you may not have access to the direct variable `req.params` you can leave an array with all the keys you'd like to create a criteria upon.

You can do the same with the request body and with multiple keys, as mentioned above. Take this example:

```javascript
cachi.check("base", { req: { body: ["page", "team"], params: ["id"] } });
```

This will make sure that the response generated by the `page` and `team` values within the request body and the `id` value within the URL parameter will only be returned when all these values match.

**This also must be done in a similar form when setting**

Hopefully within the main block of the route, you are able to access the `req` values. If not, you can **still use the same format above**.

For those that can:

```javascript
await cachi.set("id", result, 3600, { req: { params: { id: req.params.id } } });
```

So it maches the other format, except actually explicitly referencing the variable as it is defined in the current scope.

**This would only need to be done if it will be checked in the same format/manner. If when checked/set you are able to access these variables, don't worry about our format - do as you please.**
