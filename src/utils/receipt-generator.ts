import sharp from "sharp";
import path from "path";
import fs from "fs";
import { uploadOnCloudinary } from "./cloudinary.js";
import { sendDonationReceiptEmail } from "./email.js";
import { db } from "../db/db.js";

/**
 * Converts numbers into Indian currency naming convention words (including Lakh and Crore)
 */
function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  function convert(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  }
  
  return convert(num);
}

/**
 * Main function to generate, save, upload, and send the payment receipt
 */
export const generateAndSendDonationReceipt = async (donationId: string) => {
  try {
    // 1. Fetch full donation details from DB
    const donation = await db.donation.findUnique({
      where: { id: donationId },
      include: {
        campaign: {
          select: {
            title: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        company: {
          include: {
            address: true,
          },
        },
      },
    });

    if (!donation) {
      console.error(`Donation ${donationId} not found for receipt generation`);
      return;
    }

    // 2. Format details
    const receiptNo = `REC-${donation.id.substring(0, 8).toUpperCase()}`;
    const date = donation.donatedAt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const amount = donation.amount;
    const amountInWords = numberToWords(amount);
    
    // Resolve donor info
    let donorName = donation.anonymous ? "Anonymous Donor" : (donation.company?.name || donation.user?.name || "Donor");
    let email = donation.anonymous ? "N/A" : (donation.company?.email || donation.user?.email || "N/A");
    let mobile = donation.anonymous ? "N/A" : (donation.company?.phone || donation.user?.phone || "N/A");
    
    // Address
    let addressLine1 = "N/A";
    let addressLine2 = "";
    if (!donation.anonymous && donation.company?.address) {
      const addr = donation.company.address;
      addressLine1 = addr.line1 || "N/A";
      addressLine2 = `${addr.city || ""}, ${addr.state || ""} - ${addr.postalCode || ""}`;
    }

    // PAN / CIN
    const pan = (!donation.anonymous && donation.company?.cinNumber) ? donation.company.cinNumber : "N/A";

    const purpose = donation.campaign?.title || "Direct Donation to CareGanga";
    const paymentDetails = `Txn ID: ${donation.transactionId} | Gateway: ${donation.paymentMethod}`;
    const modeOfPayment = donation.paymentMethod === "simulated" ? "Simulated Payment" : "Online Payment";

    // 3. Create SVG text overlay
    const svgOverlay = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1463" height="1075" viewBox="0 0 1463 1075">
        <style>
          .text {
            font-family: 'Arial', sans-serif;
            fill: #111827;
          }
          .bold {
            font-weight: bold;
          }
          .receipt-no {
            font-size: 24px;
            font-weight: bold;
            fill: #1e3a8a;
          }
          .date-text {
            font-size: 22px;
            font-weight: bold;
            fill: #1e3a8a;
          }
          .rupees-words {
            font-size: 24px;
            fill: #111827;
          }
          .amount-num {
            font-size: 28px;
            font-weight: bold;
            fill: #b91c1c;
          }
          .donor-value {
            font-size: 20px;
            font-weight: 500;
          }
          .box-text {
            font-size: 20px;
            font-weight: 500;
          }
          .mode-text {
            font-size: 22px;
            font-weight: bold;
            fill: #065f46;
          }
        </style>
        
        <!-- Permanent Receipt No. -->
        <text x="1245" y="182" class="text receipt-no">${receiptNo}</text>
        
        <!-- Date -->
        <text x="1310" y="190" class="text date-text">${date}</text>
        
        <!-- Rupees [amount in words] only -->
        <text x="175" y="375" class="text bold rupees-words">${amountInWords} Only</text>
        
        <!-- Rupees in numbers -->
        <text x="1285" y="375" class="text amount-num">₹ ${amount.toLocaleString("en-IN")}/-</text>
        
        <!-- Donor Details -->
        <text x="200" y="462" class="text donor-value">${donorName}</text>
        <text x="200" y="497" class="text donor-value">${addressLine1}</text>
        <text x="200" y="532" class="text donor-value">${addressLine2}</text>
        <text x="200" y="567" class="text donor-value">${mobile}</text>
        <text x="200" y="602" class="text donor-value">${email}</text>
        <text x="200" y="637" class="text donor-value">${pan}</text>
        
        <!-- Purpose of Donation -->
        <text x="760" y="532" class="text box-text">${purpose}</text>
        
        <!-- Payment Details -->
        <text x="760" y="637" class="text box-text">${paymentDetails}</text>
        
        <!-- Mode of Payment -->
        <text x="610" y="742" class="text mode-text">${modeOfPayment}</text>
      </svg>
    `);

    // Paths
    const templatePath = path.join(process.cwd(), "public", "receipt_template.png");
    const tempFileName = `receipt-${donation.id}-${Date.now()}.png`;
    const tempFilePath = path.join(process.cwd(), "public", "temp", tempFileName);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 4. Render receipt using sharp
    await sharp(templatePath)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toFile(tempFilePath);

    // 5. Read file as Base64 for email attachment
    const fileBuffer = fs.readFileSync(tempFilePath);
    const base64Image = fileBuffer.toString("base64");

    // 6. Upload to Cloudinary to save receiptUrl in DB
    const uploadRes = await uploadOnCloudinary(tempFilePath, "donation-receipts");
    if (uploadRes?.secure_url) {
      await db.donation.update({
        where: { id: donationId },
        data: { receiptUrl: uploadRes.secure_url },
      });
      console.log(`Donation receipt uploaded to Cloudinary: ${uploadRes.secure_url}`);
    }

    // 7. Send email with attachment if email is available
    if (email && email !== "N/A") {
      await sendDonationReceiptEmail(
        email,
        donorName,
        amount,
        purpose,
        donation.transactionId,
        base64Image
      ).catch((err) => {
        console.error("Failed to send donation receipt email:", err);
      });
    }
  } catch (error) {
    console.error("Failed to generate and send donation receipt:", error);
  }
};
