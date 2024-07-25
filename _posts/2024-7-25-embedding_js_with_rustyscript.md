---
layout: default
title:  "Embedding a Javascript component into your Rust project"
---

# Embedding a Javascript component into your Rust project
Embedding a scripted component into your project can be daunting; but it does not need to be complicated or time-consuming.

In this post I will demonstrate a quick and easy way to embed a fully functional Javascript runtime into a rust project, complete with transpiling from Typescript, and even sandboxing the runtime from the host.

-----
&nbsp;

### The Javascript v8 runtime
The v8 runtime has been brought to the Rust ecosystem by the [Deno project](https://deno.com/). 
However, the v8 engine it relies on (and by extension the Deno core itself) comes equipped with its fair share of pitfalls and gotchas.

Enter rustyscript - a Deno API wrapper designed to abstract away the v8 engine details, and allow you to operate directly on Rust types when working with javascript modules.

### Rustyscript -- Effortless JS integration for Rust
[The rustyscript crate](https://crates.io/crates/rustyscript) is how I will be using the javascript runtime in this article - it is a Deno API wrapper for Rust that aims to prevent the common pitfalls and complications of using the v8 engine from Rust.

It will take care of details such as: 
- Transpiling typescript
- Resolving asynchronous JS
- Allowing modules to import one another
- Deserializing return values back into Rust types.
- Setting up Deno's extensions

Rustyscript will also sandbox the code from the host machine by default, blocking access to the filesystem, as well as network resources.

-----
&nbsp;

### Our first runtime

Let's spin up a basic JS runtime, and try to run some javascript.

First, we will need something to run - let's use typescript in this example. 

*Note: When transpiling, rustyscript will not perform type-checking. If you want to preserve strong-typing you will need to check the argument types yourself.*

The typescript below - let's call it `get_value.ts` - sets up a simple API; one function sets up an internal value, and another retrieves that value:

```typescript
let my_internal_value: number;

export function getValue(): number {
  return my_internal_value;
}

export function setValue(value: number) {
  my_internal_value = value * 2;
}
```

Now from the Rust side, we spin up a runtime, and import our file:

```rust
let mut module = rustyscript::import("get_value.ts")?;
```

No really, that's it - a working JS runtime with our shiny new module imported and ready to go - We can now call our module's API at will.

First, we set up our module's internal value by calling `setValue(5)`
- `::<Undefined>` here just means we don't care about what the function returns
- `json_args!` is a macro taking in a comma-separated list of serializable Rust values we can send to javascript

```rust
use rustyscript::{json_args, Undefined};
module.call::<Undefined>("setValue", json_args!(5))?;
```

Now we can get our value back out. 

Since now we do care about what type we get, we tell rustyscript to deserialize the JS function's return value as an i64.  
We will get an `Error::JsonDecode` if the wrong type is returned by javascript:

```rust
let value: i64 = module.call("getValue", json_args!())?;
```

Putting it all together we get this:

```rust
use rustyscript::{json_args, import, Undefined, Error};

fn main() -> Result<(), Error> {
  let mut module = rustyscript::import("get_value.ts")?;

  module.call::<Undefined>("setValue", json_args!(5))?;
  let value: i64 = module.call("getValue", json_args!())?;
  assert_eq!(value, 10);
}
```

This is the fastest way to interact with javascript, but by no means the only way.

-----
&nbsp;

### A more comprehensive example

Let's try it again, but this time we will add more options to our runtime.

First, we will embed our module into the executable directly; after all;  
it is a very small file we will always need - why take the overhead from the filesystem?

```rust
use rustyscript::{module, StaticModule};

const API_MODULE: StaticModule = module!(
  "get_value.ts",
  "
    let my_internal_value: number;
    export const getValue = async (): Promise<number> => new Promise((resolve) => setTimeout(() => resolve(my_internal_value), 10));
    export const setValue = (value: number) => my_internal_value = value * 2;

    export default setValue;
  ");
```

Next, we need a runtime. There are lots of options available but timeout is the only one we will use here:
- `timeout` will force any running code to fail after it elapses. It is useful for preventing your runtime from being blocked forever

```rust
use rustyscript::{json_args, Error, Runtime, RuntimeOptions, Undefined};

fn main() -> Result<(), Error> {
  let mut runtime = Runtime::new(RuntimeOptions {
    timeout: std::time::Duration::from_millis(500),
    ..Default::default()
  })?;
```

Now we can include our static module:

```rust
  let main_handle = runtime.load_module(&API_MODULE.to_module())?;
  runtime.call_entrypoint::<Undefined>(&main_handle, json_args!(2))?;

  Ok(())
}
```

The `call_entrypoint` function will call our module's setValue function for us:  
- The module's default export was found and a reference to it stored in advance on load so that this function call can be made with less overhead.

Just like before, `::<Undefined` means we do not care if the function returns a result.

Now that we have a runtime, let's add a second module that can make use of it! We'll name this file `use_value.js`

```javascript
import getValue from './get_value.ts';
export const static_value = `${await getValue()}`;
```

Now add the following to `main()`, right before the `Ok(())` at the bottom:

```rust
let handle = runtime.load_module(&Module::load("use_value.js")?)?;
let static_value: String = runtime.get_value(Some(&handle), "static_value")?;
```

We load our new module from the filesystem:
- The handle that `load_module` returns is used to give context to future calls.
- We use that returned handle to extract the const that it exports, and then we tell the compiler we'd like it as a string.

Alternatively, we can could have called `GetValue` directly, even though it is marked async:
- `call_function` blocks the current thread, using an internal Tokio runtime
- `call_function_async` would have returned a future we could await ourselves
- `call_function_immediate` does not resolve events, which would allow me to get the result as a `Promise<String>` instead

```rust
runtime.call_function(Some(&main_handle), "getValue", json_args!())?;
```

The final code looks like this:

```rust
use rustyscript::{json_args, Error, Runtime, RuntimeOptions, Undefined};
use rustyscript::{module, StaticModule};

const API_MODULE: StaticModule = module!(
  "get_value.ts",
  "
    let my_internal_value: number;
    export const getValue = async (): Promise<number> => new Promise((resolve) => setTimeout(() => resolve(my_internal_value), 10));
    export const setValue = (value: number) => my_internal_value = value * 2;

    export default setValue;
  ");

fn main() -> Result<(), Error> {
  let mut runtime = Runtime::new(RuntimeOptions {
    timeout: std::time::Duration::from_millis(500),
    ..Default::default()
  })?;

  let main_handle = runtime.load_module(&API_MODULE.to_module())?;
  runtime.call_entrypoint::<Undefined>(&main_handle, json_args!(2))?;

  let handle = runtime.load_module(&Module::load("use_value.js")?)?;
  let static_value: String = runtime.get_value(Some(&handle), "static_value")?;

  println!("The received value was {static_value}");
  Ok(())
}
```

-----
&nbsp;

### Conclusion

Embedding a JS or TS component into Rust does not have to be difficult or time-consuming.

By leveraging API wrappers like rustyscript we can include a full-fledged runtime with very little learning curve or time investment. 

Over a dozen more examples can be found on [rustyscript's GitHub repository](https://github.com/rscarson/rustyscript)