---
name: Preview JSX generics
description: A difference between the instrumented development preview and production TSX compilation.
---

Avoid explicit generic type arguments directly on JSX component usages in the instrumented preview; use typed props or callbacks instead.

**Why:** The preview instrumentation inserted metadata between the component name and its type arguments, producing invalid TSX even though TypeScript and the production build passed.

**How to apply:** When a preview reports a JSX parse error after a passing build, inspect the instrumented error output before changing otherwise-valid TypeScript.
