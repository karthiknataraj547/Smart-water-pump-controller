import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smart_water_pump/main.dart';

void main() {
  testWidgets('SmartPumpApp boots smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: SmartPumpApp()));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('SmartPump'), findsWidgets);
    expect(find.text('Sign In'), findsWidgets);
  });
}
