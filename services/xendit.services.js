import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const XENDIT_API_KEY = process.env.XENDIT_SECRET_API_KEY;
const authHeader = "Basic " + Buffer.from(`${XENDIT_API_KEY}:`).toString("base64");

// 💸 Bank transfer (disbursement)
export const requestBankPayout = async ({
  external_id,
  amount,
  bank_code,
  account_holder_name,
  account_number,
  description
}) => {
  const response = await axios.post(
    "https://api.xendit.co/disbursements",
    {
      external_id,
      amount,
      bank_code,
      account_holder_name,
      account_number,
      description,
    },
    {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};

// 💳 E-Wallet (DANA, OVO, ShopeePay)
export const requestEwalletPayout = async ({
  external_id,
  amount,
  phone_number,
  ewallet_type
}) => {
  const response = await axios.post(
    "https://3ce08da500cc.ngrok-free.app/ewallets/charges",
    {
      reference_id: external_id,
      currency: "IDR",
      amount,
      checkout_method: "ONE_TIME_PAYMENT",
      channel_code: `ID_${ewallet_type.toUpperCase()}`,
      channel_properties: {
        mobile_number: phone_number,
        success_redirect_url: "https://3ce08da500cc.ngrok-free.app/Success",
      },
    },
    {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data;
};
// ✅ Membuat invoice untuk pembayaran customer (frontend WebView)
export const createXenditInvoice = async ({
  external_id,
  payer_email,
  amount,
  description,
  customer,
  metadata = {},
}) => {
  // ✅ Logging sebelum request dikirim ke Xendit
  console.log("📤 Sending invoice request:", {
    external_id,
    amount,
    description,
    customer,
    metadata,
  });

 const response = await axios.post(
  "https://api.xendit.co/v2/invoices",
  {
    external_id,
    amount,
    description,
    payer_email, // ✅ wajib
    invoice_duration: 86400,
    currency: "IDR",
    customer: {
      email: payer_email, // ✅ wajib
      given_names: customer?.given_names || "Customer",
      mobile_number: customer?.mobile_number || "+6280000000000", // ✅ jangan kosong
    },
    success_redirect_url: "https://example.com/payment-success",
    failure_redirect_url: "https://example.com/payment-failure",
    metadata,
  },
  {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  }
);

  return response.data;
};
