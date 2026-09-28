import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  // Ordered by priority: localhost (ADB reverse USB), 127.0.0.1, LAN IP (Wi-Fi), Emulator loopback
  static const List<String> candidateUrls = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.31.54:3000',
    'http://10.0.2.2:3000',
  ];

  static const String defaultBaseUrl = 'http://localhost:3000';
  static const String fallbackLocalUrl = 'http://localhost:3000';

  late final Dio dio;
  final FlutterSecureStorage _storage;

  ApiClient({FlutterSecureStorage? storage, String? baseUrl})
      : _storage = storage ?? const FlutterSecureStorage() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl ?? defaultBaseUrl,
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 6),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          try {
            final token = await _storage.read(key: 'sp_auth_token');
            if (token != null && token.isNotEmpty) {
              options.headers['Authorization'] = 'Bearer $token';
            }
          } catch (_) {}
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // If unauthorized 401, clear stored credentials
          if (error.response?.statusCode == 401) {
            try {
              await _storage.delete(key: 'sp_auth_token');
              await _storage.delete(key: 'sp_user_id');
            } catch (_) {}
          }
          return handler.next(error);
        },
      ),
    );
  }

  void updateBaseUrl(String newUrl) {
    dio.options.baseUrl = newUrl;
  }

  /// Sends a POST request with automatic endpoint discovery across candidates
  Future<Response> postWithFallback(String path, dynamic data) async {
    dynamic lastError;
    for (final candidate in candidateUrls) {
      try {
        final testDio = Dio(
          BaseOptions(
            baseUrl: candidate,
            connectTimeout: const Duration(seconds: 3),
            receiveTimeout: const Duration(seconds: 4),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );
        final token = await _storage.read(key: 'sp_auth_token');
        if (token != null && token.isNotEmpty) {
          testDio.options.headers['Authorization'] = 'Bearer $token';
        }

        final resp = await testDio.post(path, data: data);
        dio.options.baseUrl = candidate;
        return resp;
      } catch (e) {
        lastError = e;
        if (e is DioException && e.response != null) {
          // Received HTTP response from server (e.g. 400, 401, 409), server is reached!
          dio.options.baseUrl = candidate;
          rethrow;
        }
        // Connection error or timeout, continue to next candidate
        continue;
      }
    }
    if (lastError != null) throw lastError;
    throw Exception('No candidate endpoints reachable.');
  }

  /// Sends a GET request with automatic endpoint discovery across candidates
  Future<Response> getWithFallback(String path) async {
    dynamic lastError;
    for (final candidate in candidateUrls) {
      try {
        final testDio = Dio(
          BaseOptions(
            baseUrl: candidate,
            connectTimeout: const Duration(seconds: 3),
            receiveTimeout: const Duration(seconds: 4),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        );
        final token = await _storage.read(key: 'sp_auth_token');
        if (token != null && token.isNotEmpty) {
          testDio.options.headers['Authorization'] = 'Bearer $token';
        }

        final resp = await testDio.get(path);
        dio.options.baseUrl = candidate;
        return resp;
      } catch (e) {
        lastError = e;
        if (e is DioException && e.response != null) {
          dio.options.baseUrl = candidate;
          rethrow;
        }
        continue;
      }
    }
    if (lastError != null) throw lastError;
    throw Exception('No candidate endpoints reachable.');
  }
}

final defaultApiClient = ApiClient();
