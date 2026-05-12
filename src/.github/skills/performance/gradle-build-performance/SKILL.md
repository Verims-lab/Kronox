---
name: gradle-build-performance
description: Debug and optimize Android/Gradle build performance. Use when builds are slow, investigating CI/CD performance, analyzing build scans, or identifying compilation bottlenecks.
---

# Gradle Build Performance

## When to Use
- Build times are slow (clean or incremental)
- Investigating build performance regressions
- Analyzing Gradle Build Scans
- Enabling Gradle Configuration Cache
- Reducing unnecessary recompilation
- Debugging kapt/KSP annotation processing

---

## Workflow

1. **Measure Baseline** — Clean build + incremental build times
2. **Generate Build Scan** — `./gradlew assembleDebug --scan`
3. **Identify Phase** — Configuration? Execution? Dependency resolution?
4. **Apply ONE optimization** — Don't batch changes
5. **Measure Improvement** — Compare against baseline

---

## Key Optimizations

### 1. Enable Configuration Cache
```properties
# gradle.properties
org.gradle.configuration-cache=true
org.gradle.configuration-cache.problems=warn
```

### 2. Enable Build Cache
```properties
org.gradle.caching=true
```

### 3. Enable Parallel Execution
```properties
org.gradle.parallel=true
```

### 4. Increase JVM Heap
```properties
org.gradle.jvmargs=-Xmx4g -XX:+UseParallelGC
```

### 5. Migrate kapt to KSP
KSP is 2x faster than kapt for Kotlin:
```kotlin
// Before (slow)
kapt("com.google.dagger:hilt-compiler:2.51.1")

// After (fast)
ksp("com.google.dagger:hilt-compiler:2.51.1")
```

### 6. Avoid Dynamic Dependencies
```kotlin
// BAD: Forces resolution every build
implementation("com.example:lib:+")

// GOOD: Fixed version
implementation("com.example:lib:1.2.3")
```

### 7. Use Lazy Task Configuration
```kotlin
// BAD: Eagerly configured
tasks.create("myTask") { ... }

// GOOD: Lazily configured
tasks.register("myTask") { ... }
```

---

## Verification Checklist
- [ ] Configuration cache enabled and working
- [ ] Build cache hit rate > 80% (check build scan)
- [ ] No dynamic dependency versions
- [ ] KSP used instead of kapt where possible
- [ ] Parallel execution enabled
- [ ] JVM memory tuned appropriately

---

## References
- [Optimize Build Speed](https://developer.android.com/build/optimize-your-build)
- [Gradle Configuration Cache](https://docs.gradle.org/current/userguide/configuration_cache.html)
- [Migrate from kapt to KSP](https://developer.android.com/build/migrate-to-ksp)