import { NextRequest, NextResponse } from 'next/server';
import { prisma, listScopedRules } from '@smartpump/database';
import { authenticateRequest } from '@/middleware/auth-guard';
import { verifyHardwareOwnership } from '@/middleware/ownership-guard';
import { AutomationRuleSchema } from '@smartpump/validation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;
  try {
    const rules = await listScopedRules(hardwareId, auth.user.userId);
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json({ error: 'Device not found or access denied' }, { status: 404 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id: hardwareId } = await params;
  const ownership = await verifyHardwareOwnership(hardwareId, auth.user.userId);
  if (ownership.errorResponse) return ownership.errorResponse;

  try {
    const body = await req.json();
    const parsed = AutomationRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    const rule = await prisma.automationRule.create({
      data: {
        userId: auth.user.userId,
        hardwareId,
        name: data.name,
        conditionMetric: data.conditionMetric,
        operator: data.operator,
        thresholdValue: data.thresholdValue,
        secondaryMetric: data.secondaryMetric,
        secondaryOp: data.secondaryOp,
        secondaryVal: data.secondaryVal,
        action: data.action,
        actionDurationSec: data.actionDurationSec,
        cooldownSeconds: data.cooldownSeconds
      }
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error('Create rule error:', error);
    return NextResponse.json({ error: 'Failed to create automation rule' }, { status: 500 });
  }
}
