import Razorpay from "razorpay";

// Initialize Razorpay SDK using credentials
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder_id",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "rzp_test_placeholder_secret",
});
