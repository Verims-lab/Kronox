---
name: compose-navigation
description: Implement navigation in Jetpack Compose using Navigation Compose. Use when asked to set up navigation, pass arguments between screens, handle deep links, or structure multi-screen apps.
---

# Compose Navigation

## Overview

Implement type-safe navigation in Jetpack Compose applications using the Navigation Compose library. This skill covers NavHost setup, argument passing, deep links, nested graphs, adaptive navigation, and testing.

## Setup

Add the Navigation Compose dependency:

```kotlin
// build.gradle.kts
dependencies {
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // For type-safe navigation (recommended)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}

// Enable serialization plugin
plugins {
    kotlin("plugin.serialization") version "2.0.21"
}
```

---

## Core Concepts

### 1. Define Routes (Type-Safe)

Use `@Serializable` data classes/objects for type-safe routes:

```kotlin
import kotlinx.serialization.Serializable

// Simple screen (no arguments)
@Serializable
object Home

// Screen with required argument
@Serializable
data class Profile(val userId: String)

// Screen with optional argument
@Serializable
data class Settings(val section: String? = null)
```

### 2. Create NavController

```kotlin
@Composable
fun MyApp() {
    val navController = rememberNavController()
    AppNavHost(navController = navController)
}
```

### 3. Create NavHost

```kotlin
@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = Home,
        modifier = modifier
    ) {
        composable<Home> {
            HomeScreen(onNavigateToProfile = { userId ->
                navController.navigate(Profile(userId))
            })
        }
        composable<Profile> { backStackEntry ->
            val profile: Profile = backStackEntry.toRoute()
            ProfileScreen(userId = profile.userId)
        }
    }
}
```

---

## Navigation Patterns

### Basic Navigation

```kotlin
// Navigate forward
navController.navigate(Profile(userId = "user123"))

// Navigate back
navController.popBackStack()
```

### Bottom Navigation Pattern

```kotlin
@Composable
fun MainScreen() {
    val navController = rememberNavController()
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") },
                    selected = currentDestination?.hasRoute<Home>() == true,
                    onClick = {
                        navController.navigate(Home) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        AppNavHost(navController = navController, modifier = Modifier.padding(innerPadding))
    }
}
```

---

## Critical Rules

### DO
- Use `@Serializable` routes for type safety
- Pass only IDs/primitives as arguments
- Use `popUpTo` with `launchSingleTop` for bottom navigation
- Extract `NavHost` to a separate composable for testability
- Use `SavedStateHandle.toRoute()` in ViewModels

### DON'T
- Pass complex objects as navigation arguments
- Create `NavController` inside `NavHost`
- Use string-based routes (legacy pattern)

---

## References
- [Navigation with Compose](https://developer.android.com/develop/ui/compose/navigation)
- [Type-Safe Navigation](https://developer.android.com/guide/navigation/design#compose)