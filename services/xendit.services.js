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
    "https://api.xendit.co/ewallets/charges",
    {
      reference_id: external_id,
      currency: "IDR",
      amount,
      checkout_method: "ONE_TIME_PAYMENT",
      channel_code: `ID_${ewallet_type.toUpperCase()}`,
      channel_properties: {
        mobile_number: phone_number,
        success_redirect_url: "https://example.com/success",
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
