---
name: android-testing
description: Comprehensive testing strategy involving Unit, Integration, Hilt, and Screenshot tests.
---

# Android Testing Strategies

This skill provides expert guidance on testing modern Android applications. It covers **Unit Tests**, **Hilt Integration Tests**, and **Screenshot Testing**.

## Testing Pyramid

1. **Unit Tests**: Fast, isolate logic (ViewModels, Repositories).
2. **Integration Tests**: Test interactions (Room DAOs, Retrofit vs MockWebServer).
3. **UI/Screenshot Tests**: Verify UI correctness (Compose).

## Dependencies (`libs.versions.toml`)

```toml
[libraries]
junit4 = { module = "junit:junit", version = "4.13.2" }
kotlinx-coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "kotlinxCoroutines" }
androidx-test-ext-junit = { group = "androidx.test.ext", name = "junit", version = "1.1.5" }
espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version = "3.5.1" }
compose-ui-test = { group = "androidx.compose.ui", name = "ui-test-junit4" }
hilt-android-testing = { group = "com.google.dagger", name = "hilt-android-testing", version.ref = "hilt" }
roborazzi = { group = "io.github.takahirom.roborazzi", name = "roborazzi", version.ref = "roborazzi" }
```

## Screenshot Testing with Roborazzi

Screenshot tests ensure your UI doesn't regress visually. Uses **Roborazzi** because it runs on the JVM (fast) without needing an emulator.

### Writing a Screenshot Test

```kotlin
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [33], qualifiers = RobolectricDeviceQualifiers.Pixel5)
class MyScreenScreenshotTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun captureMyScreen() {
        composeTestRule.setContent {
            MyTheme {
                MyScreen()
            }
        }

        composeTestRule.onRoot()
            .captureRoboImage()
    }
}
```

## Hilt Testing

Use `HiltAndroidRule` to inject dependencies in tests.

```kotlin
@HiltAndroidTest
class MyDaoTest {

    @get:Rule
    var hiltRule = HiltAndroidRule(this)

    @Inject
    lateinit var database: MyDatabase
    private lateinit var dao: MyDao

    @Before
    fun init() {
        hiltRule.inject()
        dao = database.myDao()
    }

    // ... tests
}
```

## ViewModel Unit Testing

```kotlin
@Test
fun `loading data updates state`() = runTest {
    val testDispatcher = StandardTestDispatcher(testScheduler)
    val repository = FakeRepository()
    val viewModel = MyViewModel(repository, testDispatcher)

    viewModel.loadData()
    advanceUntilIdle()

    assertEquals(UiState.Success(data), viewModel.uiState.value)
}
```

## Running Tests

* **Unit**: `./gradlew test`
* **Screenshots**: `./gradlew recordRoborazziDebug` (to record) / `./gradlew verifyRoborazziDebug` (to verify)
* **Instrumented**: `./gradlew connectedAndroidTest