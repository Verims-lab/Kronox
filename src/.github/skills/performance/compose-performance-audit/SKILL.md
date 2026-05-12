---
name: compose-performance-audit
description: Audit and improve Jetpack Compose runtime performance from code review and architecture. Use when asked to diagnose slow rendering, janky scrolling, excessive recompositions, or performance issues in Compose UI.
---

# Compose Performance Audit

## Overview

Audit Jetpack Compose view performance end-to-end, from instrumentation and baselining to root-cause analysis and concrete remediation steps.

## Workflow Decision Tree

- If the user provides code, start with "Code-First Review."
- If the user only describes symptoms, ask for minimal code/context, then do "Code-First Review."
- If code review is inconclusive, go to "Guide the User to Profile" and ask for Layout Inspector output or Perfetto traces.

## 1. Code-First Review

Focus on:
- **Recomposition storms** from unstable parameters or broad state changes.
- **Unstable keys** in `LazyColumn`/`LazyRow` (`key` churn, missing keys).
- **Heavy work in composition** (formatting, sorting, filtering, object allocation).
- **Unnecessary recompositions** (missing `remember`, unstable classes, lambdas).
- **Large images** without proper sizing or async loading.
- **Layout thrash** (deep nesting, intrinsic measurements).

## 2. Common Code Smells (and Fixes)

### Unstable lambda captures

```kotlin
// BAD: New lambda instance every recomposition
Button(onClick = { viewModel.doSomething(item) }) { ... }

// GOOD: Use remember or method reference
val onClick = remember(item) { { viewModel.doSomething(item) } }
Button(onClick = onClick) { ... }
```

### Expensive work in composition

```kotlin
// BAD: Sorting on every recomposition
val sorted = items.sortedBy { it.name }

// GOOD: Use remember with key
val sorted = remember(items) { items.sortedBy { it.name } }
```

### Missing keys in LazyColumn

```kotlin
// BAD: Index-based identity
LazyColumn { items(items) { item -> ItemRow(item) } }

// GOOD: Stable key-based identity
LazyColumn { items(items, key = { it.id }) { item -> ItemRow(item) } }
```

### Reading state too early

```kotlin
// BAD: State read during composition (recomposes whole tree)
val offset = scrollState.value
Box(modifier = Modifier.offset(y = offset.dp)) { ... }

// GOOD: Defer state read to layout/draw phase
Box(modifier = Modifier.offset { IntOffset(0, scrollState.value) }) { ... }
```

## 3. Stability Checklist

| Type | Stable by Default? | Fix |
|------|-------------------|-----|
| Primitives (`Int`, `String`, `Boolean`) | Yes | N/A |
| `data class` with stable fields | Yes* | Ensure all fields are stable |
| `List`, `Map`, `Set` | **No** | Use `ImmutableList` from kotlinx |
| Classes with `var` properties | **No** | Use `@Stable` if externally stable |
| Lambdas | **No** | Use `remember { }` |

## References
- [Jetpack Compose Performance](https://developer.android.com/develop/ui/compose/performance)
- [Compose Stability Explained](https://developer.android.com/develop/ui/compose/performance/stability)
- [Debugging Recomposition](https://developer.android.com/develop/ui/compose/tooling/layout-inspector)