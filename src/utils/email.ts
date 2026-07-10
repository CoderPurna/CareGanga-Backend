/**
 * Brevo Email Service Utility
 * Uses Brevo's Transactional Email REST API to send automated invoices
 */

export const sendMembershipInvoice = async (
  ngoEmail: string,
  ngoName: string,
  tierName: string,
  price: number,
  duration: number,
  paymentId: string
) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "myogoku";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "info.myogoku@gmail.com";

  if (!apiKey) {
    console.error("BREVO_API_KEY is not defined in environment variables. Email skipped.");
    return false;
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

  // Format dates for invoice
  const invoiceDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const expiryDate = new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Membership Subscription Invoice</title>
      <style>
        body {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #2D3748;
          background-color: #F7FAFC;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid #E2E8F0;
        }
        .header {
          background: linear-gradient(135deg, #4A5568 0%, #1A202C 100%);
          padding: 30px;
          text-align: center;
          color: #FFFFFF;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 5px 0 0 0;
          font-size: 14px;
          color: #CBD5E0;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin: 25px 0;
        }
        .details-table th, .details-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #E2E8F0;
        }
        .details-table th {
          color: #718096;
          font-weight: 500;
          font-size: 14px;
          text-transform: uppercase;
        }
        .details-table td {
          font-size: 15px;
        }
        .total-row {
          background-color: #EDF2F7;
          font-weight: 600;
        }
        .footer {
          background-color: #F7FAFC;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #A0AEC0;
          border-top: 1px solid #E2E8F0;
        }
        .badge {
          background-color: #C6F6D5;
          color: #22543D;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>myogoku</h1>
          <p>Care Ganga Membership Invoice</p>
        </div>
        <div class="content">
          <div class="greeting">Hello ${ngoName},</div>
          <p>Thank you for subscribing! Your payment has been successfully processed, and your NGO membership is now active.</p>
          
          <table class="details-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>NGO Name</td>
                <td><strong>${ngoName}</strong></td>
              </tr>
              <tr>
                <td>Subscription Tier</td>
                <td><span class="badge">${tierName}</span></td>
              </tr>
              <tr>
                <td>Duration</td>
                <td>${duration} Days</td>
              </tr>
              <tr>
                <td>Expiry Date</td>
                <td>${expiryDate}</td>
              </tr>
              <tr>
                <td>Payment Reference</td>
                <td><code style="font-size: 13px;">${paymentId}</code></td>
              </tr>
              <tr>
                <td>Date of Invoice</td>
                <td>${invoiceDate}</td>
              </tr>
              <tr class="total-row">
                <td>Amount Paid (INR)</td>
                <td>₹${price.toLocaleString("en-IN")}.00</td>
              </tr>
            </tbody>
          </table>

          <p style="margin-top: 30px; font-size: 14px; color: #718096;">
            If you have any questions about this invoice, please reach out to our support team at <a href="mailto:${senderEmail}" style="color: #4A5568;">${senderEmail}</a>.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} myogoku. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const payload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: ngoEmail,
          name: ngoName,
        },
      ],
      subject: `myogoku - Membership Invoice for ${ngoName}`,
      htmlContent: htmlContent,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brevo API Error (${response.status}): `, errorText);
      return false;
    }

    const data = await response.json();
    console.log("Invoice email sent successfully via Brevo: ", data);
    return true;
  } catch (error) {
    console.error("Failed to send membership invoice via Brevo: ", error);
    return false;
  }
};
