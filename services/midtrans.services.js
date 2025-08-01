import midtransClient from 'midtrans-client';

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Membuat Snap Token untuk client
export const createMidtransTransaction = async (orderData) => {
  const parameter = {
    transaction_details: {
      order_id: orderData.midtransOrderId,
      gross_amount: orderData.price,
    },
    customer_details: {
      first_name: orderData.customerName,
      email: orderData.customerEmail,
    },
  };

  return await snap.createTransaction(parameter);
};

// Digunakan oleh webhook Midtrans
export const handleMidtransNotification = async (notificationData) => {
  // Proses update status order di DB berdasarkan notifikasi
};
