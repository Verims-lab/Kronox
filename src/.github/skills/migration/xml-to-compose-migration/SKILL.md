---
name: xml-to-compose-migration
description: Convert Android XML layouts to Jetpack Compose. Use when asked to migrate Views to Compose, convert XML to Composables, or modernize UI from View system to Compose.
---

# XML to Compose Migration

## Overview

Systematically convert Android XML layouts to idiomatic Jetpack Compose, preserving functionality while embracing Compose patterns.

## Workflow

### 1. Analyze the XML Layout
- Identify the root layout type (`ConstraintLayout`, `LinearLayout`, `FrameLayout`, etc.).
- List all View widgets and their key attributes.
- Map data binding expressions (`@{}`) or view binding references.

### 2. Plan the Migration
- Decide: **Full rewrite** or **incremental migration** (using `ComposeView`/`AndroidView`).
- Identify state sources (ViewModel, LiveData, savedInstanceState).

### 3. Convert Layouts
Apply the layout mapping table below to convert each View to its Compose equivalent.

### 4. Migrate State
- Convert `LiveData` observation to `StateFlow` collection or `observeAsState()`.
- Replace `findViewById` / ViewBinding with Compose state.
- Convert click listeners to lambda parameters.

---

## Layout Mapping Reference

### Container Layouts

| XML Layout | Compose Equivalent | Notes |
|------------|-------------------|-------|
| `LinearLayout (vertical)` | `Column` | Use `Arrangement` and `Alignment` |
| `LinearLayout (horizontal)` | `Row` | Use `Arrangement` and `Alignment` |
| `FrameLayout` | `Box` | Children stack on top of each other |
| `ScrollView` | `Column` + `Modifier.verticalScroll()` | Or use `LazyColumn` for lists |
| `RecyclerView` | `LazyColumn` / `LazyRow` / `LazyGrid` | Most common migration |
| `ViewPager2` | `HorizontalPager` | From accompanist or Compose Foundation |

### Common Widgets

| XML Widget | Compose Equivalent | Notes |
|------------|-------------------|-------|
| `TextView` | `Text` | Use `style` → `TextStyle` |
| `EditText` | `TextField` / `OutlinedTextField` | Requires state hoisting |
| `Button` | `Button` | Use `onClick` lambda |
| `ImageView` | `Image` | Use `painterResource()` or Coil |
| `RecyclerView` | `LazyColumn` | Requires adapter removal |
| `CardView` | `Card` | From Material 3 |
| `Toolbar` | `TopAppBar` | Use inside `Scaffold` |
| `BottomNavigationView` | `NavigationBar` | Material 3 |

---

## Common Patterns

### RecyclerView to LazyColumn

```kotlin
// Compose
LazyColumn(modifier = Modifier.fillMaxSize()) {
    items(items, key = { it.id }) { item ->
        ItemRow(item = item, onClick = { onItemClick(item) })
    }
}
```

### LiveData to Compose

```kotlin
// After: Collecting in Compose
@Composable
fun MyScreen(viewModel: MyViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    Text(text = uiState.title)
}
```

### Embedding XML Views in Compose (Interop)

```kotlin
@Composable
fun MapViewComposable(modifier: Modifier = Modifier) {
    AndroidView(
        factory = { context -> MapView(context) },
        update = { mapView -> /* update */ },
        modifier = modifier
    )
}
```

---

## Checklist
- [ ] All layouts converted
- [ ] State hoisted properly
- [ ] Click handlers converted to lambdas
- [ ] RecyclerView adapters removed (using LazyColumn/LazyRow)
- [ ] ViewBinding/DataBinding removed
- [ ] Theming applied (MaterialTheme)
- [ ] Accessibility preserved (content descriptions, touch targets)
- [ ] Preview annotations added
- [ ] Old XML files deleted

## References
- [Interoperability APIs](https://developer.android.com/develop/ui/compose/migrate/interoperability-apis)
- [Migration Strategy](https://developer.android.com/develop/ui/compose/migrate/strategy)