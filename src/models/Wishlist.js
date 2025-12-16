const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);
// Add a method to safely get wishlist items
wishlistSchema.methods.getItems = async function () {
  await this.populate("items.product", "name price images slug status");
  return this.items;
};
const Wishlist = mongoose.model("Wishlist", wishlistSchema);

module.exports = Wishlist;
