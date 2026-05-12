---
name: android-gradle-logic
description: Expert guidance on setting up scalable Gradle build logic using Convention Plugins and Version Catalogs.
---

# Android Gradle Build Logic & Convention Plugins

This skill helps you configure a scalable, maintainable build system for Android apps using **Gradle Convention Plugins** and **Version Catalogs**.

## Goal
Stop copy-pasting code between `build.gradle.kts` files. Centralize build logic (Compose setup, Kotlin options, Hilt, etc.) in reusable plugins.

## Project Structure

```text
root/
├── build-logic/
│   ├── convention/
│   │   ├── src/main/kotlin/
│   │   │   └── AndroidApplicationConventionPlugin.kt
│   │   └── build.gradle.kts
│   └── settings.gradle.kts
├── gradle/
│   └── libs.versions.toml
├── app/
│   └── build.gradle.kts
└── settings.gradle.kts
```

## Step 1: Configure `settings.gradle.kts`

```kotlin
// settings.gradle.kts
pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
```

## Step 2: Define Dependencies in `libs.versions.toml`

```toml
[versions]
androidGradlePlugin = "8.2.0"
kotlin = "1.9.20"

[plugins]
android-application = { id = "com.android.application", version.ref = "androidGradlePlugin" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
# Define your own plugins here
nowinandroid-android-application = { id = "nowinandroid.android.application", version = "unspecified" }
```

## Step 3: Create a Convention Plugin

```kotlin
// AndroidApplicationConventionPlugin.kt
import com.android.build.api.dsl.ApplicationExtension
import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.kotlin.dsl.configure

class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            with(pluginManager) {
                apply("com.android.application")
                apply("org.jetbrains.kotlin.android")
            }

            extensions.configure<ApplicationExtension> {
                defaultConfig.targetSdk = 34
                // Configure common options here
            }
        }
    }
}
```

Register in `build-logic/convention/build.gradle.kts`:

```kotlin
gradlePlugin {
    plugins {
        register("androidApplication") {
            id = "nowinandroid.android.application"
            implementationClass = "AndroidApplicationConventionPlugin"
        }
    }
}
```

## Usage

```kotlin
// app/build.gradle.kts
plugins {
    alias(libs.plugins.nowinandroid.android.application)
}
```

This drastically cleans up module-level build files.