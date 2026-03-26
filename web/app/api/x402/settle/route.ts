import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { verifyPaymentProof, type PaymentProof } from "@/lib/x402";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request.clone());
    if (!auth.valid) {
      return NextResponse.json(
        { error: "Authentication required for facilitator endpoints" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { proof } = body as { proof: PaymentProof };

    if (!proof?.buyer || !proof?.requirement?.skillListingAddress) {
      return NextResponse.json(
        {
          error: "Missing proof.buyer or proof.requirement.skillListingAddress",
        },
        { status: 400 }
      );
    }

    const result = await verifyPaymentProof(proof);
    return NextResponse.json({
      settlement_id: result.paymentRef,
      status: result.status === "valid" ? "complete" : result.status,
      error: result.error,
    });
  } catch (error: any) {
    console.error("POST /api/x402/settle error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
