---
name: android-retrofit
description: Expert guidance on setting up and using Retrofit for type-safe HTTP networking in Android. Covers service definitions, coroutines, OkHttp configuration, and Hilt integration.
---

# Android Networking with Retrofit

## Instructions

When implementing network layers using **Retrofit**, follow these modern Android best practices.

### 1. URL Manipulation

```kotlin
interface SearchService {
    @GET("group/{id}/users")
    suspend fun groupList(
        @Path("id") groupId: Int,
        @Query("sort") sort: String?,
        @QueryMap options: Map<String, String> = emptyMap()
    ): List<User>
}
```

### 2. Request Body & Form Data

```kotlin
interface UserService {
    @POST("users/new")
    suspend fun createUser(@Body user: User): User

    @FormUrlEncoded
    @POST("user/edit")
    suspend fun updateUser(
        @Field("first_name") first: String,
        @Field("last_name") last: String
    ): User

    @Multipart
    @PUT("user/photo")
    suspend fun uploadPhoto(
        @Part("description") description: RequestBody,
        @Part photo: MultipartBody.Part
    ): User
}
```

### 3. Header Manipulation

```kotlin
interface WidgetService {
    @Headers("Cache-Control: max-age=640000")
    @GET("widget/list")
    suspend fun widgetList(): List<Widget>

    @GET("user")
    suspend fun getUser(@Header("Authorization") token: String): User
}
```

### 4. Response Handling

```kotlin
@GET("users")
suspend fun getUsers(): List<User>      // Throws HttpException on error

@GET("users")
suspend fun getUsersResponse(): Response<List<User>> // Manual check
```

### 5. Hilt & Serialization Configuration

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
        .connectTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl("https://api.example.com/")
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
}
```

### 6. Error Handling in Repositories

```kotlin
class GitHubRepository @Inject constructor(private val service: GitHubService) {
    suspend fun getRepos(username: String): Result<List<Repo>> = runCatching {
        service.listRepos(username)
    }.onFailure { exception ->
        // Handle specific exceptions like UnknownHostException or SocketTimeoutException
    }
}
```

### 7. Checklist
- [ ] Use `suspend` functions for all network calls.
- [ ] Prefer `Response<T>` if you need to handle specific status codes (e.g., 401 Unauthorized).
- [ ] Use `@Path` and `@Query` instead of manual string concatenation for URLs.
- [ ] Configure `OkHttpClient` with logging (for debug) and sensible timeouts.
- [ ] Map API DTOs to Domain models to decouple layers.