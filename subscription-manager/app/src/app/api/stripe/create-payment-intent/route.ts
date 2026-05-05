import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, userAddress } = body;

    if (!amount || !userAddress) {
      return NextResponse.json(
        { error: "Missing amount or userAddress" },
        { status: 400 }
      );
    }

    const MIN_STRIPE_INR = 50; // ₹50 minimum for Stripe INR
    const finalAmount = Math.max(amount, MIN_STRIPE_INR * 100); // in paise

    console.log(
      `[Stripe] Creating payment intent: ₹${finalAmount / 100} for ${userAddress}`
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "inr",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userAddress,
        requestedAmount: amount.toString(),
      },
    });

    console.log(`[Stripe] Payment intent created: ${paymentIntent.id}`);

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("[Stripe] Create intent failed");
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
