const User = require("../models/userModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Order = require("../models/orderModel");
const uniqid = require("uniqid");

const PhonePe = require('../config/phonepe');

const asyncHandler = require("express-async-handler");
const { generateToken } = require("../config/jwtToken");
const validateMongoDbId = require("../utils/validateMongodbId");
const { generateRefreshToken } = require("../config/refreshtoken");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
// const sendEmail = require("./emailCtrl");

const onlinepayment = asyncHandler(async (req, res) => {
  // Retrieve and validate user ID
  const { _id } = req.user;
  validateMongoDbId(_id);

  // Find the user's cart
  const user = await User.findById(_id);
  const cart = await Cart.findOne({ orderby: user._id });

  if (!cart) {
    throw new Error("No cart found for the user");
  }

  // Prepare the payment payload
  // Since the generate method in the PhonePe class already handles the details, we just need to provide userId
  try {
    // Generate the PhonePe payment URL
    const paymentURL = await phonepe.generate({}, _id); // Passing the user ID to the generate method

    // You can then redirect the user to the paymentURL or send it as part of the response
    res.json({ paymentURL });
  } catch (error) {
    console.error(error);
    throw new Error("Payment initiation failed");
  }
});



// Create a User ----------------------------------------------

const createUser = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const findUser = await User.findOne({ email });

  if (!findUser) {
    const newUser = await User.create(req.body);
    res.json(newUser);
  } else {
    throw new Error("User Already Exists");
  }
});

// Create a User as Guest
const createUserAsGuest = async (req, res) => {
  try {
    // Create a unique guest identifier
    const guestIdentifier = `guest_${uniqid()}`;
    console.log('Guest identifier:', guestIdentifier);

    // Create a guest user with a unique identifier
    // Create a guest user with a unique identifier
    const guestUser = new User({
      role: 'guest',
      email: guestIdentifier, // Using the unique guest identifier as email
      mobile: `placeholder_${guestIdentifier}`, // Placeholder value for mobile
    });

    // Save the guest user to the database
    await guestUser.save();

    // Generate a token for the guest user
    const token = generateToken(guestUser._id);

    // Respond with the guest user's details and token
    res.json({
      msg: 'Guest user created successfully',
      user: guestUser,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      msg: 'An error occurred while creating the guest user',
    });
  }
};

// ... Rest of the code

// Login a user
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // check if user exists or not
  const findUser = await User.findOne({ email });
  if (findUser && (await findUser.isPasswordMatched(password))) {
    const refreshToken = await generateRefreshToken(findUser?._id);
    const updateuser = await User.findByIdAndUpdate(

      findUser.id,
      {
        refreshToken: refreshToken,
      },
      { new: true }
    );
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      _id: findUser?._id,
      name: findUser?.name,
      email: findUser?.email,
      mobile:findUser?.mobile,
      address:findUser?.address,
      token: generateToken(findUser?._id),
    });
  } else {
    throw new Error("Invalid Credentials");
  }
});


// admin login

const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // check if user exists or not
  const findAdmin = await User.findOne({ email });
  if (findAdmin.role !== "admin") throw new Error("Not Authorised");
  if (findAdmin && (await findAdmin.isPasswordMatched(password))) {
    const refreshToken = await generateRefreshToken(findAdmin?._id);
    const updateuser = await User.findByIdAndUpdate(
      findAdmin.id,
      {
        refreshToken: refreshToken,
      },
      { new: true }
    );
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      _id: findAdmin?._id,
      firstname: findAdmin?.firstname,
      lastname: findAdmin?.lastname,
      email: findAdmin?.email,
      mobile: findAdmin?.mobile,
      token: generateToken(findAdmin?._id),
    });
  } else {
    throw new Error("Invalid Credentials");
  }
});

// handle refresh token

const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error("No Refresh Token in Cookies");
  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });
  if (!user) throw new Error(" No Refresh token present in db or not matched");
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err || user.id !== decoded.id) {
      throw new Error("There is something wrong with refresh token");
    }
    const accessToken = generateToken(user?._id);
    res.json({ accessToken });
  });
});

// logout functionality

const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.token) throw new Error("No Refresh Token in Cookies");
  const token = cookie.token;
  const user = await User.findOne({ token });
  if (!user) {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
    });
    return res.sendStatus(204); // forbidden
  }
  await User.findOneAndUpdate(token, {
    token: "",
  });
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
  });
  res.sendStatus(204); // forbidden
});

// Update a user

const updatedUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        firstname: req?.body?.firstname,
        lastname: req?.body?.lastname,
        email: req?.body?.email,
        mobile: req?.body?.mobile,
        address: req?.body?.address
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});


// save user Address

const saveAddress = asyncHandler(async (req, res, next) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        address: req?.body?.address,
      },
      {
        new: true,
      }
    );
    res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

// Get all users

const getallUser = asyncHandler(async (req, res) => {
  try {
    const getUsers = await User.find().populate("wishlist");
    res.json(getUsers);
  } catch (error) {
    throw new Error(error);
  }
});

// Get a single user

const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const getaUser = await User.findById(id);
    res.json({
      getaUser,
    });
  } catch (error) {
    throw new Error(error);
  }
});


// Get a single user

const deleteaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const deleteaUser = await User.findByIdAndDelete(id);
    res.json({
      deleteaUser,
    });
  } catch (error) {
    throw new Error(error);
  }
});

const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const blockusr = await User.findByIdAndUpdate(
      id,
      {
        isBlocked: true,
      },
      {
        new: true,
      }
    );
    res.json(blockusr);
  } catch (error) {
    throw new Error(error);
  }
});

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const unblock = await User.findByIdAndUpdate(
      id,
      {
        isBlocked: false,
      },
      {
        new: true,
      }
    );
    res.json({
      message: "User UnBlocked",
    });
  } catch (error) {
    throw new Error(error);
  }
});

// const updatePassword = asyncHandler(async (req, res) => {
//   const { _id } = req.user;
//   const { password } = req.body;
//   validateMongoDbId(_id);
//   const user = await User.findById(_id);
//   if (password) {
//     user.password = password;
//     const updatedPassword = await user.save();
//     res.json(updatedPassword);
//   } else {
//     res.json(user);
//   }
// });

// const forgotPasswordToken = asyncHandler(async (req, res) => {
//   const { email } = req.body;
//   const user = await User.findOne({ email });
//   if (!user) throw new Error("User not found with this email");
//   try {
//     const token = await user.createPasswordResetToken();
//     await user.save();
//     const resetURL = `Hi, Please follow this link to reset Your Password. This link is valid till 10 minutes from now. <a href='http://localhost:5000/api/user/reset-password/${token}'>Click Here</>`;
//     const data = {
//       to: email,
//       text: "Hey User",
//       subject: "Forgot Password Link",
//       htm: resetURL,
//     };
//     sendEmail(data);
//     res.json(token);
//   } catch (error) {
//     throw new Error(error);
//   }
// });

// const resetPassword = asyncHandler(async (req, res) => {
//   const { password } = req.body;
//   const { token } = req.params;
//   const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
//   const user = await User.findOne({
//     passwordResetToken: hashedToken,
//     passwordResetExpires: { $gt: Date.now() },
//   });
//   if (!user) throw new Error(" Token Expired, Please try again later");
//   user.password = password;
//   user.passwordResetToken = undefined;
//   user.passwordResetExpires = undefined;
//   await user.save();
//   res.json(user);
// });


const getWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  try {
    const findUser = await User.findById(_id).populate("wishlist");
    res.json(findUser);
  } catch (error) {
    throw new Error(error);
  }
});



const userCart = asyncHandler(async (req, res) => {
  const { cart} = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);

  
  try {
    const user = await User.findById(_id);
    let existingCart = await Cart.findOne({ orderby: user._id });
    if (existingCart) {
    // Update existing cart
for (let i = 0; i < cart.length; i++) {
  const existingProduct = existingCart.products.find(
    (product) => product.product.toString() === cart[i]._id &&
                 product.size === cart[i].size &&
                 product.color === cart[i].color
  );


  
  await existingCart.save();

  if (existingProduct) {
    // Product with the same ID, size, and color already exists in the cart, increase the count
    existingProduct.count += cart[i].count;
  } else {
    // Product doesn't exist in the cart, add it
    let object = {};
    object.product = cart[i]._id;
    object.count = cart[i].count;
    object.color = cart[i].color;
    object.images = cart[i].images;
    object.size = cart[i].size;
    let getPrice = await Product.findById(cart[i]._id)
      .select("price")
      .exec();
    object.price = getPrice.price;
    existingCart.products.push(object);
  }
}

      // Recalculate the cart total
      existingCart.cartTotal = 0;
      for (let i = 0; i < existingCart.products.length; i++) {
        existingCart.cartTotal +=
          existingCart.products[i].price * existingCart.products[i].count;
            // Add or update the address if provided

      }

      await existingCart.save();
      
      // Update existingCart object with user ID
      existingCart = {
        ...existingCart.toObject(),
        userId: user._id,
      };

      res.json(existingCart);
    } else {
      // Create new cart
      let products = [];

      for (let i = 0; i < cart.length; i++) {
        let object = {};
        object.product = cart[i]._id;
       
        object.count = cart[i].count;
        object.color = cart[i].color;
        object.images = cart[i].images;
        object.size = cart[i].size;
        let getPrice = await Product.findById(cart[i]._id)
          .select("price")
          .exec();
        object.price = getPrice.price;
        products.push(object);
      }

      let cartTotal = 0;
      for (let i = 0; i < products.length; i++) {
        cartTotal += products[i].price * products[i].count;
      }

      const newCart = await new Cart({
        products,
        cartTotal,
        orderby: user._id,
   
      }).save();

      // Update newCart object with user ID
      const updatedCart = {
        ...newCart.toObject(),
        userId: user._id,
      };

      res.json(updatedCart);
    }
  } catch (error) {
    throw new Error(error);
  }
});

const fetchUserCart = async (userId) => {
  try {
    const cart = await Cart.findOne({ orderby: userId }).populate("products.product");
    return cart; // Returns the cart object
  } catch (error) {
    throw new Error(error);
  }
};


const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const cart = await Cart.findOne({ orderby: _id }).populate(
      "products.product"
    );
    res.json(cart);
  } catch (error) {
    throw new Error(error);
  }
});


const addAddressToCart = asyncHandler(async (req, res) => {
  const { address } = req.body;
  const { _id } = req.user;

  // Validate the user ID and address input
  validateMongoDbId(_id);
  // You may also validate the address structure here

  try {
    const user = await User.findById(_id);
    let existingCart = await Cart.findOne({ orderby: user._id });

    if (!existingCart) {
      // If no existing cart, you can choose to create one or return an error
      return res.status(404).json({ error: 'Cart not found' });
    }

    // Update the address in the cart
    existingCart.address = address;

    await existingCart.save();

    // Return the updated cart
    res.json(existingCart);
  } catch (error) {
    // Handle any errors
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the address' });
  }
});


const emptyCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const user = await User.findOne({ _id });
    const cart = await Cart.findOneAndRemove({ orderby: user._id });
    res.json(cart);
  } catch (error) {
    throw new Error(error);
  }
});

// Create a new endpoint to remove a cart item from the user's cart
const removeCartItem = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const cartItemId = req.params.cartItemId;
  
  try {
    const user = await User.findOne({ _id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the cart item in the user's cart and remove it
    const cart = await Cart.findOneAndUpdate(
      { orderby: user._id },
      { $pull: { products: { _id: cartItemId } } },
      { new: true }
    );

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});




const applyCoupon = asyncHandler(async (req, res) => {
  const { coupon } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);
  const validCoupon = await Coupon.findOne({ name: coupon });
  if (validCoupon === null) {
    throw new Error("Invalid Coupon");
  }

  // Retrieve user and cart information
  const user = await User.findOne({ _id });
  const cart = await Cart.findOne({ orderby: user._id }).populate("products.product");
  const { cartTotal, products } = cart;

  // Check minimum cart total
  if (cartTotal < validCoupon.minCartTotal) {
    throw new Error(`Coupon is applicable only for cart total of at least $${validCoupon.minCartTotal}`);
  }

  // Calculate total product count considering the count of each product
  const totalProductCount = products.reduce((total, item) => total + item.count, 0);

  // Check minimum product count (if applicable)
  if (validCoupon.minProductCount && totalProductCount < validCoupon.minProductCount) {
    throw new Error(`Coupon is applicable only for at least ${validCoupon.minProductCount} products in the cart`);
  }


// Check if coupon is applicable to the product categories in the cart (if applicable)
if (validCoupon.productCategories && validCoupon.productCategories.length > 0) {
  const applicableCategories = new Set(validCoupon.productCategories);
  if (!products.some(product => applicableCategories.has(product.product.category))) {
    throw new Error(`Coupon is not applicable to the product categories in the cart`);
  }
}

  // Calculate the total after discount
  let totalAfterDiscount = (cartTotal - (cartTotal * validCoupon.discount) / 100).toFixed(2);
  await Cart.findOneAndUpdate({ orderby: user._id }, { totalAfterDiscount }, { new: true });
  res.json(totalAfterDiscount);
});





const createOrder = asyncHandler(async (req, res) => {
  const { COD, couponApplied } = req.body; // Removed address from here since we'll fetch it from the cart
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    if (!COD) throw new Error("Create cash order failed");
    const user = await User.findById(_id);
    let userCart = await Cart.findOne({ orderby: user._id });

    // Retrieve the address from the user's cart
    const address = userCart ? userCart.address : null;
    if (!address) throw new Error("Address information not found in the cart");

    let finalAmount = 0;
    if (couponApplied && userCart.totalAfterDiscount) {
      finalAmount = userCart.totalAfterDiscount;
    } else {
      finalAmount = userCart.cartTotal;
    }
  
    const order = new Order({
      products: userCart.products,
      paymentIntent: {
        id: uniqid(),
        method: "COD",
        amount: finalAmount,
        status: "Cash on Delivery",
        created: Date.now(),
        currency: "rupees",
      },
      address: address, // Using the address retrieved from the cart
      orderby: user._id,
      orderStatus: "Cash on Delivery",
    });
    
    await order.save(); // Save the order to the database

    let update = userCart.products.map((item) => {
      return {
        updateOne: {
          filter: { _id: item.product._id },
          update: { $inc: { quantity: -item.count, sold: +item.count } },
        },
      };
    });

    const updated = await Product.bulkWrite(update, {});
    res.json({ message: "success" });
  } catch (error) {
    throw new Error(error);
  }
});





const getOrders = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const userorders = await Order.find({ orderby: _id })
      .populate("products.product")
      .populate("orderby")
      .exec();
      console.log(userorders);
    res.json(userorders);
  } catch (error) {
    throw new Error(error);
  }
});



const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const alluserorders = await Order.find()
      .populate("products.product")
      .populate("orderby")
      .exec();
    res.json(alluserorders);
  } catch (error) {
    throw new Error(error);
  }
});
const getOrderByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const userorders = await Order.findOne({ orderby: id })
      .populate("products.product")
      .populate("orderby")
      .exec();
    res.json(userorders);
  } catch (error) {
    throw new Error(error);
  }
});
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const updateOrderStatus = await Order.findByIdAndUpdate(
      id,
      {
        orderStatus: status,
        paymentIntent: {
          status: status,
        },
      },
      { new: true }
    );
    res.json(updateOrderStatus);
  } catch (error) {
    throw new Error(error);
  }
});

module.exports = {
  createUser,
  createUserAsGuest,
  loginUserCtrl,
  getallUser,
  getaUser,
  deleteaUser,
  updatedUser,
  blockUser,
  unblockUser,
  handleRefreshToken,
  logout,
  // updatePassword,
  // forgotPasswordToken,
  // resetPassword,
  loginAdmin,
  getWishlist,
  saveAddress,
  addAddressToCart,
  userCart,
  fetchUserCart,
  getUserCart,
  emptyCart,
  removeCartItem,
  applyCoupon,
  createOrder,
  onlinepayment,
  getOrders,
  updateOrderStatus,
  getAllOrders,
  getOrderByUserId,
};