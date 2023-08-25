//External Dependency
const sha256 = require("sha256");
const axios = require("axios");
const key_gen = require("./keygen");

/**
 * Creates a new instance of the PhonePe integration.
 *
 * @constructor
 * @param {string} PHONEPE_MERCHANT_ID - The unique identifier of the merchant on PhonePe.
 * @param {string} PHONEPE_MERCHANT_USER_ID - The unique identifier of the merchant user on PhonePe.
 * @param {string} PHONEPE_CALLBACK_URL - The callback URL where PhonePe will send transaction notifications.
 * @param {string} PHONEPE_KEY - The secret key used for secure communication with PhonePe APIs.
 */
class PhonePe {
  constructor(PHONEPE_MERCHANT_ID, PHONEPE_MERCHANT_USER_ID, PHONEPE_CALLBACK_URL, PHONEPE_KEY, fetchUserCartFunction) {
    this.merchant_id ="PGTESTPAYUAT";
    this.merchant_user_id = PHONEPE_MERCHANT_USER_ID;
    this.phonepe_callback_url = "https://www.immortals.org.in/api/user/onlinepayment";
    this.phonepe_key =	"099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
    this.fetchUserCart = fetchUserCartFunction;

    
  }

  /**
   * Asynchronously generates a transaction ID and sets it to the instance.
   *
   * @async
   * @function
   * @param {string} tnxId - Optional. An existing transaction ID to be used. If not provided, a new transaction ID will be generated.
   * @returns {Promise<string>} The generated or existing transaction ID.
   */

  async createTxn(tnxId) {
    this.tnxId = await key_gen();
    return this.tnxId;
  }
  base64gen(payload) {
    let b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    return b64;
  }
  sha256gen(b64) {
    let preformatter = b64 + "/pg/v1/pay" + this.phonepe_key;
    let sha256_data = sha256(preformatter);
    sha256_data = sha256_data + "###" + 1;
    return sha256_data;
  }

  /**
   * Asynchronously generates transaction details based on the provided data and transaction ID.
   * The method must be called after initializing the instance and creating a transaction ID.
   *
   * @async
   * @function
   * @param {object} data - An object containing transaction data.
   * @param {number} data.amount - The amount associated with the transaction.
   * @throws {Error} If the transaction ID is not set, it will first attempt to create one.
   * @throws {Error} If the provided data is empty or missing the 'amount' field.
   * @returns {Promise<object>} An object containing the generated transaction details.
   */

  async generate(data, userId) {
    if (!this.tnxId) {
      await this.createTxn();
    }
    // use this.fetchUserCart instead of directly calling fetchUserCart
    const cart = await this.fetchUserCart(userId);

    if (!cart || !cart.cartTotal) {
      return Error("Amount is required in payload");
    }

      // Fetch the mobile number from the cart's address
  const mobileNumber = cart.address?.mobile;
     
    let PAYLOAD = {
      merchantId: this.merchant_id,
      merchantUserId: this.merchant_user_id,
      amount: cart.cartTotal, // Use the cart total as the amount
      merchantTransactionId: this.tnxId,
      callbackUrl: this.phonepe_callback_url,
      redirectUrl: "https://www.immortals.org.in/functions/orderpage.html",
      redirectMode: "POST",
      mobileNumber:mobileNumber,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };
    let base64Data = this.base64gen(PAYLOAD);
    let sha256Data = this.sha256gen(base64Data);
    let getURI = await this.sendRequest(sha256Data, base64Data);
    return getURI;
  }

  async sendRequest(X_VERIFY, BODY) {
    const options = {
      method: "POST",
      url:"https://api.phonepe.com/apis/hermes/pg/v1/pay",
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": X_VERIFY,
      },
      data: {
        request: BODY,
      },
    };
    try {
      let { data } = await axios.request(options, {
        data: {
          request: BODY,
        },
      });
      return data.data;
    } catch (error) {
      console.trace(
        `Request Failed with status ${error.response.data.code}. Refer https://developer.phonepe.com/v1/reference/pay-api`
      );
    }
  }

    /**
   * Asynchronously checks the status of a transaction.
   *
   * @async
   * @function
   * @param {string} merchantId - The merchant ID associated with the transaction.
   * @param {string} merchantTransactionId - The merchant transaction ID for which the status is to be checked.
   * @returns {Promise<object>} An object containing the transaction status details.
   */
    async checkStatus(merchantId, merchantTransactionId) {
      const url = `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`;
      try {
        const response = await axios.get(url);
        return response.data;
      } catch (error) {
        console.trace(`Request Failed to check status with error: ${error}`);
        throw error; // Re-throw the error so the calling code can handle it
      }
    }
}

module.exports = PhonePe;