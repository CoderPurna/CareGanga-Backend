/**
 * Email HTML Template Generators
 * Keeps email HTML structures separated from delivery logic
 */

/**
 * Returns the HTML body for a membership subscription invoice
 */
export const getMembershipInvoiceTemplate = (
  ngoName: string,
  tierName: string,
  price: number,
  duration: number,
  expiryDate: string,
  paymentId: string,
  invoiceDate: string,
  senderEmail: string
) => {
  return `
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
};

/**
 * Returns the HTML body for a volunteer application pending status
 */
export const getVolunteerPendingTemplate = (volunteerName: string, ngoName: string) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Volunteer Registration Received</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, sans-serif; color: #2D3748; background-color: #F7FAFC; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
        .header { background: #4A5568; padding: 30px; text-align: center; color: #FFFFFF; }
        .content { padding: 40px 30px; line-height: 1.6; }
        .status-badge { background-color: #FEFCBF; color: #744210; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; text-transform: uppercase; }
        .footer { background-color: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>myogoku Volunteer Application</h2>
        </div>
        <div class="content">
          <p>Hi <strong>${volunteerName}</strong>,</p>
          <p>Thank you for your interest in volunteering for <strong>${ngoName}</strong>! Your application has been successfully received and is currently under review.</p>
          <p><strong>Current Status:</strong> <span class="status-badge">Pending</span></p>
          <p>The NGO administrative team will evaluate your skills and availability and update your status shortly. You will receive an automated email as soon as a decision is made.</p>
          <p style="color: #718096; font-size: 14px; margin-top: 30px;">Thank you for your patience,<br/>The myogoku Team</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} myogoku. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Returns the HTML body for volunteer application approval or rejection status
 */
export const getVolunteerStatusTemplate = (
  volunteerName: string,
  ngoName: string,
  status: string,
  badgeColor: string,
  isApproved: boolean,
  notes?: string
) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Volunteer Application Update</title>
      <style>
        body { font-family: 'Segoe UI', Roboto, sans-serif; color: #2D3748; background-color: #F7FAFC; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; }
        .header { background: #4A5568; padding: 30px; text-align: center; color: #FFFFFF; }
        .content { padding: 40px 30px; line-height: 1.6; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; text-transform: uppercase; }
        .remarks-box { background-color: #EDF2F7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #A0AEC0; font-style: italic; }
        .footer { background-color: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Volunteer Application Update</h2>
        </div>
        <div class="content">
          <p>Hi <strong>${volunteerName}</strong>,</p>
          <p>There is an update on your volunteer application for <strong>${ngoName}</strong>.</p>
          <p><strong>Status Update:</strong> <span class="status-badge" style="${badgeColor}">${status}</span></p>
          
          ${
            isApproved
              ? `<p>Congratulations! Your application has been approved. The NGO team will connect with you soon to discuss your onboarding and next steps.</p>`
              : `<p>Thank you for your interest. Unfortunately, your application has not been approved at this time. We encourage you to check out other volunteer opportunities on the platform.</p>`
          }

          ${notes ? `<div class="remarks-box"><strong>NGO Remarks:</strong> "${notes}"</div>` : ""}

          <p style="color: #718096; font-size: 14px; margin-top: 30px;">Warm regards,<br/>The myogoku Team</p>
        </div>
        <div class="footer">&copy; ${new Date().getFullYear()} myogoku. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;
};
