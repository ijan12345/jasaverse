/**
 * Utility untuk membuat error dengan status dan message kustom,
 * serta stack trace yang jelas.
 */
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.status = statusCode;

  // Menambahkan stack trace secara eksplisit untuk debug (opsional tapi direkomendasikan)
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, createError);
  }

  return error;
};

export default createError;
