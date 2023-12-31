const mongoose = require("mongoose"); // Erase if already required
const bcrypt = require("bcrypt");
const crypto = require("crypto");
// Declare the Schema of the Mongo model


const addressSchema = new mongoose.Schema({

    name: { 
      type: String,
      required: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    useraddress: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
  });



  var userSchema = new mongoose.Schema(
    {

      name: {
        type: String,
        required: function() { return this.role === 'user'; },
      },
      email: {
        type: String,
        unique: true,
        required: function() { return this.role === 'user'; },
      },
      mobile: {
        type: String,
        unique: true,
        required: function() { return this.role === 'user'; },
      },
      password: {
        type: String,
        required: function() { return this.role === 'user'; },
      },
      role: {
        type: String,
        enum: ['user', 'guest'],
        default: 'user',
      },
      cart: {
        type: Array,
        default: [],
      },

      wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      refreshToken: {
        type: String,
      },
      passwordChangedAt: Date,
      passwordResetToken: String,
      passwordResetExpires: Date,
    },
    {
      timestamps: true,
    }
  );

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSaltSync(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
userSchema.methods.isPasswordMatched = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.methods.createPasswordResetToken = async function () {
  const resettoken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resettoken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 10 minutes
  return resettoken;
};

//Export the model
module.exports = mongoose.model("User", userSchema);