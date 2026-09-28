import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';

class AuthException implements Exception {
  final String message;
  const AuthException(this.message);

  @override
  String toString() => message;
}

class AuthState {
  final bool isAuthenticated;
  final bool hasClaimedHardware;
  final String? userId;
  final String? userEmail;
  final String? userName;
  final String? accessToken;
  final bool isRestoring;
  final String? errorMessage;

  const AuthState({
    this.isAuthenticated = false,
    this.hasClaimedHardware = false,
    this.userId,
    this.userEmail,
    this.userName,
    this.accessToken,
    this.isRestoring = false,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? hasClaimedHardware,
    String? userId,
    String? userEmail,
    String? userName,
    String? accessToken,
    bool? isRestoring,
    String? errorMessage,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      hasClaimedHardware: hasClaimedHardware ?? this.hasClaimedHardware,
      userId: userId ?? this.userId,
      userEmail: userEmail ?? this.userEmail,
      userName: userName ?? this.userName,
      accessToken: accessToken ?? this.accessToken,
      isRestoring: isRestoring ?? this.isRestoring,
      errorMessage: errorMessage,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FlutterSecureStorage _storage;
  final ApiClient _apiClient;

  AuthNotifier({FlutterSecureStorage? storage, ApiClient? apiClient})
      : _storage = storage ?? const FlutterSecureStorage(),
        _apiClient = apiClient ?? defaultApiClient,
        super(const AuthState(isAuthenticated: false, isRestoring: true)) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      final token = await _storage.read(key: 'sp_auth_token');
      final userId = await _storage.read(key: 'sp_user_id');
      final email = await _storage.read(key: 'sp_user_email');
      final userName = await _storage.read(key: 'sp_user_name');
      final hasHardwareStr = await _storage.read(key: 'sp_has_hardware');
      final hasHardware = hasHardwareStr == 'true';

      if (token != null && token.isNotEmpty && userId != null && userId.isNotEmpty) {
        state = AuthState(
          isAuthenticated: true,
          hasClaimedHardware: hasHardware,
          userId: userId,
          userEmail: email,
          userName: userName ?? email?.split('@').first,
          accessToken: token,
          isRestoring: false,
        );
        return;
      }
    } catch (_) {
      // Storage read error fallback
    }
    state = const AuthState(isAuthenticated: false, isRestoring: false);
  }

  /// Authenticate user credentials against backend API
  /// Without proper authentication, login is strictly rejected.
  Future<void> login(String email, String password) async {
    final cleanEmail = email.trim().toLowerCase();
    final cleanPassword = password.trim();

    if (cleanEmail.isEmpty) {
      throw const AuthException('Please enter your email address.');
    }
    if (cleanPassword.isEmpty) {
      throw const AuthException('Please enter your account password.');
    }

    try {
      final response = await _apiClient.postWithFallback(
        '/api/auth/login',
        {
          'email': cleanEmail,
          'password': cleanPassword,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final user = data['user'] as Map<String, dynamic>? ?? {};
        final tokens = data['tokens'] as Map<String, dynamic>? ?? {};

        final accessToken = tokens['accessToken'] as String? ?? '';
        final userId = user['id'] as String? ?? 'usr_${cleanEmail.hashCode.abs()}';
        final fullName = user['fullName'] as String? ?? cleanEmail.split('@').first;
        final hasHardware = user['hasHardware'] == true;

        await _storage.write(key: 'sp_auth_token', value: accessToken);
        await _storage.write(key: 'sp_user_id', value: userId);
        await _storage.write(key: 'sp_user_email', value: cleanEmail);
        await _storage.write(key: 'sp_user_name', value: fullName);
        await _storage.write(key: 'sp_has_hardware', value: hasHardware ? 'true' : 'false');

        state = AuthState(
          isAuthenticated: true,
          hasClaimedHardware: hasHardware,
          userId: userId,
          userEmail: cleanEmail,
          userName: fullName,
          accessToken: accessToken,
          isRestoring: false,
        );
        return;
      } else {
        throw const AuthException('Invalid email or password.');
      }
    } on DioException catch (dioErr) {
      if (dioErr.response != null) {
        final statusCode = dioErr.response?.statusCode;
        final resData = dioErr.response?.data;
        String errMsg = 'Invalid email or password.';
        if (resData is Map && resData['error'] != null) {
          errMsg = resData['error'].toString();
        }
        if (statusCode == 401) {
          throw AuthException(errMsg);
        } else if (statusCode == 400) {
          throw AuthException(errMsg);
        } else if (statusCode == 429) {
          throw const AuthException('Too many login attempts. Please wait 1 minute.');
        } else {
          throw AuthException('Authentication server error ($statusCode): $errMsg');
        }
      } else {
        // Connection could not reach backend server
        throw const AuthException('Cannot reach authentication server. Please check your network connection.');
      }
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException('Authentication failed: ${e.toString()}');
    }
  }

  /// Register new user account against backend API
  Future<void> register({
    required String email,
    required String password,
    required String fullName,
    String? phoneNumber,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    final cleanPassword = password.trim();

    if (cleanEmail.isEmpty || !cleanEmail.contains('@')) {
      throw const AuthException('Please enter a valid email address.');
    }
    if (cleanPassword.length < 8) {
      throw const AuthException('Password must be at least 8 characters long.');
    }
    if (fullName.trim().isEmpty) {
      throw const AuthException('Please enter your full name.');
    }

    try {
      final payload = <String, dynamic>{
        'email': cleanEmail,
        'password': cleanPassword,
        'fullName': fullName.trim(),
      };
      if (phoneNumber != null && phoneNumber.trim().isNotEmpty) {
        payload['phoneNumber'] = phoneNumber.trim();
      }

      final response = await _apiClient.postWithFallback(
        '/api/auth/register',
        payload,
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final user = data['user'] as Map<String, dynamic>? ?? {};
        final tokens = data['tokens'] as Map<String, dynamic>? ?? {};

        final accessToken = tokens['accessToken'] as String? ?? '';
        final userId = user['id'] as String? ?? 'usr_${cleanEmail.hashCode.abs()}';

        await _storage.write(key: 'sp_auth_token', value: accessToken);
        await _storage.write(key: 'sp_user_id', value: userId);
        await _storage.write(key: 'sp_user_email', value: cleanEmail);
        await _storage.write(key: 'sp_user_name', value: fullName);
        await _storage.write(key: 'sp_has_hardware', value: 'false'); // Brand new user has no hardware yet

        state = AuthState(
          isAuthenticated: true,
          hasClaimedHardware: false, // Must proceed to setup wizard!
          userId: userId,
          userEmail: cleanEmail,
          userName: fullName,
          accessToken: accessToken,
          isRestoring: false,
        );
      } else {
        throw const AuthException('Registration failed. Please try again.');
      }
    } on DioException catch (dioErr) {
      if (dioErr.response != null) {
        final resData = dioErr.response?.data;
        String errMsg = 'Registration failed.';
        if (resData is Map && resData['error'] != null) {
          errMsg = resData['error'].toString();
        }
        throw AuthException(errMsg);
      } else {
        throw const AuthException('Cannot reach registration server. Please check your connection.');
      }
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException('Registration error: ${e.toString()}');
    }
  }

  /// Mark hardware as claimed and isolated to this registered user
  Future<void> claimHardware() async {
    state = state.copyWith(hasClaimedHardware: true);
    try {
      await _storage.write(key: 'sp_has_hardware', value: 'true');
    } catch (_) {}
  }

  Future<void> removeHardware() async {
    state = state.copyWith(hasClaimedHardware: false);
    try {
      await _storage.write(key: 'sp_has_hardware', value: 'false');
    } catch (_) {}
  }

  Future<void> logout() async {
    state = const AuthState(isAuthenticated: false, hasClaimedHardware: false, isRestoring: false);
    try {
      await _storage.deleteAll();
    } catch (_) {}
  }

  Future<void> toggleHardwareState() async {
    final newState = !state.hasClaimedHardware;
    state = state.copyWith(hasClaimedHardware: newState);
    try {
      await _storage.write(key: 'sp_has_hardware', value: newState ? 'true' : 'false');
    } catch (_) {}
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
