/**
 * Brevo Email Service Utility
 * Uses Brevo's Transactional Email REST API to send automated notifications and invoices
 */
import {
  getMembershipInvoiceTemplate,
  getVolunteerPendingTemplate,
  getVolunteerStatusTemplate,
} from "./mail-templates.js";

/**
 * Sends a transactional invoice email to an NGO upon successful membership payment
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
    console.error("BREVO_API_KEY is not defined. Email skipped.");
    return false;
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

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

  // Load the structured HTML from our external template generator
  const htmlContent = getMembershipInvoiceTemplate(
    ngoName,
    tierName,
    price,
    duration,
    expiryDate,
    paymentId,
    invoiceDate,
    senderEmail
  );

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: ngoEmail, name: ngoName }],
      subject: `myogoku - Membership Invoice for ${ngoName}`,
      htmlContent,
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

/**
 * Sends a confirmation email to a volunteer upon registration (Pending status)
 */
export const sendVolunteerPendingEmail = async (
  volunteerEmail: string,
  volunteerName: string,
  ngoName: string
) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "myogoku";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "info.myogoku@gmail.com";

  if (!apiKey) {
    console.error("BREVO_API_KEY is not defined. Email skipped.");
    return false;
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";

  // Load the structured HTML from our external template generator
  const htmlContent = getVolunteerPendingTemplate(volunteerName, ngoName);

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: volunteerEmail, name: volunteerName }],
      subject: `Volunteer Registration Received - ${ngoName}`,
      htmlContent,
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

    return response.ok;
  } catch (error) {
    console.error("Failed to send volunteer pending email: ", error);
    return false;
  }
};

/**
 * Sends a notification email to a volunteer when their application is approved or rejected
 */
export const sendVolunteerStatusEmail = async (
  volunteerEmail: string,
  volunteerName: string,
  ngoName: string,
  status: string,
  notes?: string
) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderName = process.env.BREVO_SENDER_NAME || "myogoku";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "info.myogoku@gmail.com";

  if (!apiKey) {
    console.error("BREVO_API_KEY is not defined. Email skipped.");
    return false;
  }

  const endpoint = "https://api.brevo.com/v3/smtp/email";
  const isApproved = status.toUpperCase() === "APPROVED";
  const badgeColor = isApproved
    ? "background-color: #C6F6D5; color: #22543D;"
    : "background-color: #FED7D7; color: #742A2A;";

  // Load the structured HTML from our external template generator
  const htmlContent = getVolunteerStatusTemplate(
    volunteerName,
    ngoName,
    status,
    badgeColor,
    isApproved,
    notes
  );

  try {
    const payload = {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: volunteerEmail, name: volunteerName }],
      subject: `Volunteer Application Update - ${ngoName}`,
      htmlContent,
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

    return response.ok;
  } catch (error) {
    console.error("Failed to send volunteer status email: ", error);
    return false;
  }
};
