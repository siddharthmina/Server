//External Dependency
const sha256 = require("sha256");
const axios = require("axios");
const key_gen = require("./keygen");
const Cart = require("../models/cartModel");


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
  constructor() {
    this.merchant_id ="IMMORTALSONLINE";
    // this.merchant_user_id = "MUID123";
    this.phonepe_callback_url = "https://www.immortals.org.in/functions/prepaidordersuccesfull.html";
    this.phonepe_key = "92a0803e-6cc4-4531-84cc-1736ced40ad2";
    // this.fetchUserCart = fetchUserCartFunction;
  }

  /**
   * Asynchronously generates a transaction ID and sets it to the instance.
  *
   * @async
   * @function
   * @param {string} tnxId - Optional. An existing transaction ID to be used. If not provided, a new transaction ID will be generated.
   * @returns {Promise<string>} The generated or existing transaction ID.
   */


async fetchUserCart(userId) {
  try {
    const cart = await Cart.findOne({ orderby: userId }).populate("products.product");
    return cart; // Returns the cart object
  } catch (error) {
    throw new Error(error);
  }
};

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

  async generate(data, userId,finalAmount) {
    if (!this.tnxId) {
      await this.createTxn();
    }
    // use this.fetchUserCart instead of directly calling fetchUserCart
    const cart = await this.fetchUserCart(userId);

    if (!cart || !cart.cartTotal) {
      return Error("Amount is required in payload");
    }

 

      // Fetch the mobile number from the cart's address
      const mobileNumber = cart.address && cart.address.length > 0 ? cart.address[0].mobile : undefined;

      console.log(userId);
     
      await Cart.updateOne({ orderby: userId }, { transactionId: this.tnxId });

    let PAYLOAD = {
      merchantId: this.merchant_id,
      merchantUserId:userId,
      amount: finalAmount, // Use the cart total as the amount
      merchantTransactionId: this.tnxId,
      callbackUrl: this.phonepe_callback_url,
      redirectUrl: "https://www.immortals.org.in/functions/prepaidordersuccesfull.html",
      redirectMode: "GET",
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
      const options = {
       method: 'GET',
       url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
       headers: {
       accept: 'application/json',
       'Content-Type': 'application/json',
       'X-VERIFY': checksum,
       'X-MERCHANT-ID': `${merchantId}`
       }
       };
      // CHECK PAYMENT STATUS
       axios.request(options).then(async(response) => {
       if (response.data.success === true) {
       console.log(response.data)
       return res.status(200).send({success: true, message:"Payment Success"});
       } else {
       return res.status(400).send({success: false, message:"Payment Failure"});
       }
       })
       .catch((err) => {
       console.error(err);
       res.status(500).send({msg: err.message});
       });
      };
}

module.exports = {PhonePe};
