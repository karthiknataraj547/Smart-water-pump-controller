import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthState {
  final bool isAuthenticated;
  final bool hasClaimedHardware;
  final String? userEmail;
  final String? userName;
  final bool isRestoring;

  const AuthState({
    this.isAuthenticated = false,
    this.hasClaimedHardware = false,
    this.userEmail,
    this.userName,
    this.isRestoring = false,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? hasClaimedHardware,
    String? userEmail,
    String? userName,
    bool? isRestoring,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      hasClaimedHardware: hasClaimedHardware ?? this.hasClaimedHardware,
      userEmail: userEmail ?? this.userEmail,
      userName: userName ?? this.userName,
      isRestoring: isRestoring ?? this.isRestoring,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final FlutterSecureStorage _storage;

  AuthNotifier([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage(),
        super(const AuthState(isAuthenticated: false, isRestoring: false)) {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      final token = await _storage.read(key: 'sp_auth_token');
      final email = await _storage.read(key: 'sp_user_email');
      final userName = await _storage.read(key: 'sp_user_name');
      final hasHardwareStr = await _storage.read(key: 'sp_has_hardware');
      final hasHardware = hasHardwareStr != 'false'; // default true if claimed before

      if (token != null && token.isNotEmpty && email != null && email.isNotEmpty) {
        state = AuthState(
          isAuthenticated: true,
          hasClaimedHardware: hasHardware,
          userEmail: email,
          userName: userName ?? email.split('@').first,
          isRestoring: false,
        );
        return;
      }
    } catch (_) {
      // In test or non-platform environments, safely fall back
    }
    state = const AuthState(isAuthenticated: false, isRestoring: false);
  }

  Future<void> login(String email, {bool hasHardware = true}) async {
    final userName = email.split('@').first;
    state = state.copyWith(
      isAuthenticated: true,
      hasClaimedHardware: hasHardware,
      userEmail: email,
      userName: userName,
      isRestoring: false,
    );
    try {
      await _storage.write(key: 'sp_auth_token', value: 'jwt_mock_token_${DateTime.now().millisecondsSinceEpoch}');
      await _storage.write(key: 'sp_user_email', value: email);
      await _storage.write(key: 'sp_user_name', value: userName);
      await _storage.write(key: 'sp_has_hardware', value: hasHardware ? 'true' : 'false');
    } catch (_) {}
  }

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
