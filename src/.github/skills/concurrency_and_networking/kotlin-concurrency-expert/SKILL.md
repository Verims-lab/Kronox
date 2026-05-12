---
name: kotlin-concurrency-expert
description: Kotlin Coroutines review and remediation for Android. Use when asked to review concurrency usage, fix coroutine-related bugs, improve thread safety, or resolve lifecycle issues in Kotlin/Android code.
---

# Kotlin Concurrency Expert

## Overview

Review and fix Kotlin Coroutines issues in Android codebases by applying structured concurrency, lifecycle safety, proper scoping, and modern best practices with minimal behavior changes.

## Common Fixes

- **ANR / Main thread blocking**: Move heavy work to `withContext(Dispatchers.IO)` or `Dispatchers.Default`.
- **Memory leaks / zombie coroutines**: Replace `GlobalScope` with a lifecycle-bound scope (`viewModelScope`, `lifecycleScope`).
- **Lifecycle collection issues**: Replace deprecated `launchWhenStarted` with `repeatOnLifecycle(Lifecycle.State.STARTED)`.
- **State exposure**: Encapsulate `MutableStateFlow` / `MutableSharedFlow`; expose read-only `StateFlow`.
- **CancellationException swallowing**: Ensure generic `catch (e: Exception)` blocks rethrow `CancellationException`.

## Critical Rules

### Dispatcher Injection (Testability)

```kotlin
// CORRECT: Inject dispatcher
class UserRepository(
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    suspend fun fetchUser() = withContext(ioDispatcher) { ... }
}
```

### Lifecycle-Aware Collection

```kotlin
// CORRECT: Use repeatOnLifecycle
viewLifecycleOwner.lifecycleScope.launch {
    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { state -> updateUI(state) }
    }
}

// INCORRECT: Direct collection (unsafe, deprecated)
lifecycleScope.launchWhenStarted {
    viewModel.uiState.collect { state -> updateUI(state) }
}
```

### State Encapsulation

```kotlin
// CORRECT: Expose read-only StateFlow
class MyViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()
}
```

### Exception Handling

```kotlin
// CORRECT: Rethrow CancellationException
try {
    doSuspendWork()
} catch (e: CancellationException) {
    throw e // Must rethrow!
} catch (e: Exception) {
    handleError(e)
}
```

### Cooperative Cancellation

```kotlin
// CORRECT: Check for cancellation in tight loops
suspend fun processLargeList(items: List<Item>) {
    items.forEach { item ->
        ensureActive() // Check cancellation
        processItem(item)
    }
}
```

### Callback Conversion

```kotlin
// CORRECT: callbackFlow with awaitClose
fun locationUpdates(): Flow<Location> = callbackFlow {
    val listener = LocationListener { location -> trySend(location) }
    locationManager.requestLocationUpdates(listener)
    awaitClose { locationManager.removeUpdates(listener) }
}
```

## Scope Guidelines

| Scope | Use When | Lifecycle |
|-------|----------|-----------|
| `viewModelScope` | ViewModel operations | Cleared with ViewModel |
| `lifecycleScope` | UI operations in Activity/Fragment | Destroyed with lifecycle owner |
| `repeatOnLifecycle` | Flow collection in UI | Started/Stopped with lifecycle state |
| `applicationScope` (injected) | App-wide background work | Application lifetime |
| `GlobalScope` | **NEVER USE** | Breaks structured concurrency |

## References
- [Kotlin Coroutines Best Practices](https://developer.android.com/kotlin/coroutines/coroutines-best-practices)
- [StateFlow and SharedFlow](https://developer.android.com/kotlin/flow/stateflow-and-sharedflow)
- [repeatOnLifecycle API](https://developer.android.com/topic/libraries/architecture/coroutines#repeatOnLifecycle)