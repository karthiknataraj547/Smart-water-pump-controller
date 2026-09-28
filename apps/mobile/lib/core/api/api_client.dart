import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  // Ordered by priority: Production Cloud (Vercel), Local LAN IP (Wi-Fi), USB ADB reverse, Emulator
  static const List<String> defaultCandidates = [
    'https://smart-water-pump-controller.vercel.app',
    'http://192.168.31.55:3000',
    'http://192.168.31.54:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.2.2:3000',
  ];

  static const String defaultBaseUrl = 'https://smart-water-pump-controller.vercel.app';

  late final Dio dio;
  final FlutterSecureStorage _storage;
  String? _workingUrl;

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

  String get activeBaseUrl => _workingUrl ?? dio.options.baseUrl;

  void updateBaseUrl(String newUrl) {
    _workingUrl = newUrl;
    dio.options.baseUrl = newUrl;
  }

  Future<String?> getCustomServerUrl() async {
    try {
      return await _storage.read(key: 'sp_custom_server_url');
    } catch (_) {
      return null;
    }
  }

  Future<void> setCustomServerUrl(String? url) async {
    try {
      if (url == null || url.trim().isEmpty) {
        await _storage.delete(key: 'sp_custom_server_url');
      } else {
        String cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'http://$cleanUrl';
        }
        await _storage.write(key: 'sp_custom_server_url', value: cleanUrl);
        updateBaseUrl(cleanUrl);
      }
    } catch (_) {}
  }

  /// Test connectivity to a specific server URL
  Future<bool> testServerUrl(String url) async {
    String cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://$cleanUrl';
    }
    try {
      final testDio = Dio(
        BaseOptions(
          baseUrl: cleanUrl,
          connectTimeout: const Duration(seconds: 3),
          receiveTimeout: const Duration(seconds: 3),
        ),
      );
      final resp = await testDio.get('/api/health');
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Builds a dynamic list of candidate URLs, checking custom URL first
  Future<List<String>> _resolveCandidates() async {
    final list = <String>[];
    
    // 1. Check custom server URL if configured by user
    final custom = await getCustomServerUrl();
    if (custom != null && custom.isNotEmpty) {
      list.add(custom);
    }

    // 2. Add currently working URL if known
    if (_workingUrl != null && !list.contains(_workingUrl)) {
      list.add(_workingUrl!);
    }

    // 3. Add default candidates
    for (final c in defaultCandidates) {
      if (!list.contains(c)) {
        list.add(c);
      }
    }

    return list;
  }

  /// Sends a POST request with automatic endpoint discovery across candidates
  Future<Response> postWithFallback(String path, dynamic data) async {
    final candidates = await _resolveCandidates();
    dynamic lastError;

    for (final candidate in candidates) {
      try {
        final testDio = Dio(
          BaseOptions(
            baseUrl: candidate,
            connectTimeout: const Duration(seconds: 3),
            receiveTimeout: const Duration(seconds: 5),
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
        _workingUrl = candidate;
        dio.options.baseUrl = candidate;
        return resp;
      } catch (e) {
        lastError = e;
        if (e is DioException && e.response != null) {
          // Received valid HTTP response from server (e.g. 400, 401, 409), server is reached!
          _workingUrl = candidate;
          dio.options.baseUrl = candidate;
          rethrow;
        }
        // Network connection error / timeout, continue searching candidates
        continue;
      }
    }
    if (lastError != null) throw lastError;
    throw Exception('No candidate endpoints reachable.');
  }

  /// Sends a GET request with automatic endpoint discovery across candidates
  Future<Response> getWithFallback(String path) async {
    final candidates = await _resolveCandidates();
    dynamic lastError;

    for (final candidate in candidates) {
      try {
        final testDio = Dio(
          BaseOptions(
            baseUrl: candidate,
            connectTimeout: const Duration(seconds: 3),
            receiveTimeout: const Duration(seconds: 5),
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
        _workingUrl = candidate;
        dio.options.baseUrl = candidate;
        return resp;
      } catch (e) {
        lastError = e;
        if (e is DioException && e.response != null) {
          _workingUrl = candidate;
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
