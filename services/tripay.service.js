// services/tripay.service.js
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

// ✅ Konfigurasi dari environment variable
const BASE_URL = process.env.TRIPAY_BASE_URL;
const API_KEY = process.env.TRIPAY_API_KEY;
const PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;

if (!BASE_URL || !API_KEY || !PRIVATE_KEY) {
  throw new Error("❌ Tripay BASE_URL, API_KEY, atau PRIVATE_KEY belum diatur di .env");
}

/**
 * ✅ Buat transaksi pembayaran (checkout)
 * @param {Object} payload - Data untuk membuat transaksi
 */
export const createTransaction = async (payload) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Gagal membuat transaksi Tripay:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * ✅ Ambil status transaksi berdasarkan reference
 * @param {String} reference - Kode referensi transaksi
 */
export const getTransactionStatus = async (reference) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/transaction/detail?reference=${reference}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Gagal mengambil status transaksi:", error.response?.data || error.message);
    throw error;
  }
};

/**
 * ✅ Request penarikan (payout) ke rekening bank via Tripay
 * @param {Object} param0 - Objek payout berisi amount, bankCode, accountNumber, name, note
 */
export const requestPayout = async ({ amount, bankCode, accountNumber, name, note }) => {
  try {
    const merchantRef = "WD" + Date.now(); // Contoh: WD1687213894213

    const payload = {
      method: bankCode,
      merchant_ref: merchantRef,
      amount,
      name,
      account_number: accountNumber,
      note,
    };

    const response = await axios.post(`${BASE_URL}/transaction/payout`, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("❌ Gagal request payout Tripay:", error.response?.data || error.message);
    throw error;
  }
};
